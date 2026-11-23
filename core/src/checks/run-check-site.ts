import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { parseSiteConfig } from "@siti/config";
import { checkSite, siteWarnings } from "./check-site.ts";

/**
 * Si lancia dalla cartella del sito dopo `astro build`:
 * `node ../../core/src/checks/run-check-site.ts [--probe <modulo>]...`
 * Ogni `--probe` è un modulo (percorso relativo alla cartella del sito) che esporta
 * `PROBE_CLASSES: string[]`: classi di un altro pacchetto (il preset) che devono arrivare nel CSS.
 */
const site = process.cwd();
const dist = join(site, "dist");
const args = process.argv.slice(2);
const extraProbeClasses: string[] = [];
for (let index = 0; index < args.length; index++) {
	if (args[index] !== "--probe") continue;
	const target = args[index + 1];
	if (!target) throw new Error("--probe richiede un percorso");
	const module = await import(pathToFileURL(join(site, target)).href);
	if (!Array.isArray(module.PROBE_CLASSES)) {
		throw new Error(`${target}: manca l'export PROBE_CLASSES`);
	}
	extraProbeClasses.push(...module.PROBE_CLASSES);
}

/** Cartelle che non si visitano (output, dipendenze, cache): si saltano durante la visita. */
const SKIPPED_DIRECTORIES = new Set([
	"dist",
	"node_modules",
	".astro",
	".sanity",
]);

function listFiles(
	directory: string,
	accept: RegExp,
	skip: ReadonlySet<string> = new Set(),
): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			if (!skip.has(entry.name)) found.push(...listFiles(path, accept, skip));
		} else if (entry.isFile() && accept.test(entry.name)) {
			found.push(path);
		}
	}
	return found;
}

const css = listFiles(dist, /\.css$/)
	.map((path) => readFileSync(path, "utf8"))
	.join("\n");
// Tailwind scansiona TUTTA la cartella del sito (non solo `src`): la sentinella si cerca in
// ogni file di testo, tranne l'output, le dipendenze e il CSS generato dal DESIGN.md.
const sources = listFiles(
	site,
	/\.(?:astro|ts|tsx|mjs|js|css|md|mdx|json|html|svg)$/,
	SKIPPED_DIRECTORIES,
)
	.filter((path) => !path.endsWith(".generated.css"))
	.map((path) => readFileSync(path, "utf8"));

const pages = listFiles(dist, /\.html$/).map((path) => ({
	path: relative(dist, path),
	html: readFileSync(path, "utf8"),
}));
const { default: siteConfig } = await import(
	pathToFileURL(join(site, "site.config.ts")).href
);
const config = parseSiteConfig(siteConfig);

const jsGzipBytes = listFiles(dist, /\.js$/).reduce(
	(total, path) => total + gzipSync(readFileSync(path)).length,
	0,
);

for (const warning of siteWarnings({ jsGzipBytes }))
	console.warn(`WARN: ${warning}`);

const problems = checkSite({
	css,
	sources,
	pages,
	config,
	headersFile: existsSync(join(dist, "_headers"))
		? readFileSync(join(dist, "_headers"), "utf8")
		: null,
	robotsFile: existsSync(join(dist, "robots.txt"))
		? readFileSync(join(dist, "robots.txt"), "utf8")
		: null,
	jsGzipBytes,
	extraProbeClasses,
});
if (existsSync(join(dist, "sitemap.xml")) !== (config.indexing === "allow")) {
	problems.push("sitemap.xml mancante o incoerente con indexing");
}
if (problems.length > 0) {
	console.error(`FAIL: ${problems.join("; ")}`);
	process.exit(1);
}
console.log(
	`OK: il CSS del sito contiene le classi e le regole del core (${css.length} byte)`,
);
