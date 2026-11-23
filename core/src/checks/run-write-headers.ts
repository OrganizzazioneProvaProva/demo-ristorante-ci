import {
	existsSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmdirSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseSiteConfig } from "@siti/config";
import { notFoundPath } from "../content/not-found.ts";
import { securityHeaders } from "../content/security.ts";
import { moveCspAfterCharset } from "./csp-html.ts";

const dist = join(process.cwd(), "dist");
const { default: siteConfig } = await import(
	pathToFileURL(join(process.cwd(), "site.config.ts")).href
);
const config = parseSiteConfig(siteConfig);
const pages = readdirSync(dist, { recursive: true, withFileTypes: true })
	.filter((file) => file.isFile() && file.name.endsWith(".html"))
	.map((file) => {
		const path = join(file.parentPath, file.name);
		const html = readFileSync(path, "utf8");
		return { path, html, normalized: moveCspAfterCharset(html, path) };
	});
for (const { path, html, normalized } of pages) {
	if (html !== normalized) writeFileSync(path, normalized);
}
// In formato directory Astro riserva 404.html alla radice. Cloudflare lo cerca anche nelle sottocartelle.
for (const language of config.languages) {
	if (language === config.defaultLanguage) continue;
	const folder = join(dist, language, "404");
	const source = join(folder, "index.html");
	if (!existsSync(source)) continue;
	const target = join(dist, notFoundPath(language, config));
	if (existsSync(target))
		throw new Error(`Due pagine 404 per ${language} in dist.`);
	renameSync(source, target);
	if (readdirSync(folder).length === 0) rmdirSync(folder);
}
writeFileSync(join(dist, "_headers"), securityHeaders(config.indexing));
console.log(
	`OK: meta CSP posizionato in ${pages.length} pagine e dist/_headers scritto`,
);
