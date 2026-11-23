import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TURNSTILE_ORIGIN } from "../content/security.ts";
import { locateCsp } from "./csp-html.ts";

type Mutation = readonly [
	file: string,
	edit: (text: string) => string | null,
	reason: RegExp,
];

function editMeta(html: string, edit: (tag: string) => string) {
	const { startOffset, endOffset } = locateCsp(html, "index.html").tag;
	return (
		html.slice(0, startOffset) +
		edit(html.slice(startOffset, endOffset)) +
		html.slice(endOffset)
	);
}

function snapshot(dist: string) {
	return readdirSync(dist, { recursive: true, withFileTypes: true })
		.filter((file) => file.isFile())
		.sort((a, b) =>
			join(a.parentPath, a.name).localeCompare(join(b.parentPath, b.name)),
		)
		.map((file) => {
			const path = join(file.parentPath, file.name);
			const { mtimeNs, ctimeNs } = statSync(path, { bigint: true });
			return [path, mtimeNs, ctimeNs, readFileSync(path)];
		});
}

const checker = fileURLToPath(new URL("./run-check-site.ts", import.meta.url));

function check(site: string) {
	const dist = join(site, "dist");
	const before = snapshot(dist);
	const result = spawnSync(process.execPath, [checker], {
		cwd: site,
		encoding: "utf8",
	});
	assert.ifError(result.error);
	assert.deepEqual(
		snapshot(dist),
		before,
		"run-check-site deve soltanto leggere dist",
	);
	return result;
}

export function checkDistMutations(site: URL, turnstile: boolean) {
	const source = fileURLToPath(site);
	const baseline = check(source);
	assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
	const header = "_headers";
	const home = "index.html";
	const edits: Mutation[] = [
		[
			"sitemap.xml",
			() => '<?xml version="1.0"?><urlset/>',
			/sitemap\.xml.*incoerente con indexing/,
		],
		["en/404.html", () => null, /en\/404\.html: pagina 404 mancante/],
		[
			home,
			(s) => s.replace('<meta name="robots" content="noindex">', ""),
			/meta robots noindex mancante/,
		],
		[
			header,
			(s) => s.replace("  X-Robots-Tag: noindex\n", ""),
			/x-robots-tag: valore obbligatorio/,
		],
		[
			"robots.txt",
			(s) => s.replace("Allow: /", "Disallow: /"),
			/robots.txt.*incoerente/,
		],
		[
			header,
			(s) => s.replace("frame-ancestors 'none'; ", ""),
			/_headers: frame-ancestors.*mancante/,
		],
		[
			header,
			(s) => s.replace("max-age=31536000", "max-age=0"),
			/_headers: strict-transport-security/,
		],
		[header, () => null, /manca dist\/_headers/],
		[
			header,
			(s) => `${s}  x-CONTENT-type-OPTIONS: nosniff\n`,
			/x-content-type-options: header duplicato/,
		],
		[
			header,
			(s) => `${s}/en/*\n  Referrer-Policy: no-referrer\n`,
			/un solo blocco.*override/,
		],
		[
			header,
			(s) => s.replace("frame-ancestors", "script-src 'self'; frame-ancestors"),
			/_headers: script-src.*non prevista/,
		],
		[
			home,
			(s) =>
				editMeta(s, (tag) =>
					tag.replace(
						"font-src 'self'",
						"font-src 'self' https://extra.example",
					),
				),
			/font-src: sorgenti/,
		],
		[
			home,
			(s) =>
				editMeta(s, (tag) =>
					tag.replace(
						"font-src 'self'",
						"font-src 'self' 'https://extra.example'",
					),
				),
			/font-src: host tra apici/,
		],
		[
			home,
			(s) => editMeta(s, (tag) => `<style>body{color:inherit}</style>${tag}`),
			/meta CSP deve precedere/,
		],
		[home, (s) => editMeta(s, () => ""), /meta CSP mancante/],
		[home, (s) => editMeta(s, (tag) => tag + tag), /meta CSP duplicato/],
		[
			home,
			(s) =>
				editMeta(s, (tag) =>
					tag.replace(/(style-src 'self') 'sha256-[^']+'/, "$1"),
				),
			/hash SHA-256 di uno style/,
		],
		[
			home,
			(s) => s.replace(/(<style\b[^>]*>)/i, "$1/* modifica di prova */"),
			/hash SHA-256 di uno style/,
		],
		[
			home,
			(s) => s.replace("</body>", "<script>void 0</script></body>"),
			/script inline eseguibile/,
		],
		[
			home,
			(s) => s.replace(/<body\b/, '<body style="color:inherit"'),
			/attributo style=/,
		],
		[
			home,
			(s) => s.replace(/<body\b/, '<body onload="void 0"'),
			/handler inline/,
		],
		[
			home,
			(s) =>
				editMeta(s, (tag) =>
					tag.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'"),
				),
			/unsafe-inline/,
		],
		[
			home,
			(s) =>
				editMeta(s, (tag) =>
					tag.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'"),
				),
			/unsafe-eval/,
		],
		[
			home,
			(s) =>
				editMeta(s, (tag) =>
					turnstile
						? tag.replace(`frame-src ${TURNSTILE_ORIGIN}`, "frame-src 'none'")
						: tag.replace("frame-src 'none'", `frame-src ${TURNSTILE_ORIGIN}`),
				),
			/frame-src: sorgenti/,
		],
		[
			home,
			(s) =>
				editMeta(s, (tag) =>
					turnstile
						? tag.replace(
								`script-src 'self' ${TURNSTILE_ORIGIN}`,
								"script-src 'self'",
							)
						: tag.replace(
								"script-src 'self'",
								`script-src 'self' ${TURNSTILE_ORIGIN}`,
							),
				),
			/script-src: sorgenti/,
		],
	];
	if (turnstile) {
		edits.push([
			"en/cookie/index.html",
			(html) =>
				html.replace(
					/<p\b[^>]*\bdata-cookie-tool="turnstile"[^>]*>[\s\S]*?<\/p>/,
					'<p data-cookie-tool="none">This site does not use cookies.</p>',
				),
			/en\/cookie\/index\.html: informativa cookie incoerente.*turnstile/,
		]);
	}
	for (const [file, edit, expected] of edits) {
		const copy = mkdtempSync(join(tmpdir(), "siti-policy-"));
		try {
			cpSync(join(source, "dist"), join(copy, "dist"), { recursive: true });
			cpSync(join(source, "site.config.ts"), join(copy, "site.config.ts"));
			const target = join(copy, "dist", file);
			const original = existsSync(target) ? readFileSync(target, "utf8") : null;
			const changed = edit(original ?? "");
			assert.notEqual(
				changed,
				original,
				`mutazione non applicata: ${expected}`,
			);
			if (changed === null) rmSync(target);
			else writeFileSync(target, changed);
			const result = check(copy);
			assert.equal(
				result.status,
				1,
				`${expected}: ${result.stdout}${result.stderr}`,
			);
			assert.match(result.stderr, expected);
		} finally {
			rmSync(copy, { recursive: true, force: true });
		}
	}
	console.log(
		`OK: baseline exit 0, ${edits.length} mutazioni del dist exit 1, artefatti in sola lettura`,
	);
}
