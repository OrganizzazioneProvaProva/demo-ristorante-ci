import assert from "node:assert/strict";
import { test } from "node:test";
import { locateCsp, moveCspAfterCharset } from "./csp-html.ts";

const prefix = '<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">';
const style =
	"<style>\n@font-face { font-family: Test; src: url(/font.woff2) }\n</style>";
const resource = `${style}<link rel="stylesheet" href="/site.css">`;
const csp =
	'<meta http-equiv="content-security-policy" content="default-src \'self\'">';
const suffix = "</head><body><h1>Prova</h1></body></html>";

test("sposta il tag Astro per offset, lasciando identici stile, risorse e policy", () => {
	const html = prefix + resource + csp + suffix;
	const result = moveCspAfterCharset(html, "index.html");
	assert.equal(result, prefix + csp + resource + suffix);
	assert.equal(
		locateCsp(result, "index.html").policy,
		locateCsp(html, "index.html").policy,
	);
	assert.equal(locateCsp(result, "index.html").early, true);
	assert.equal(moveCspAfterCharset(result, "index.html"), result);
});

test("riconosce virgolette e ordine degli attributi e ignora il falso meta in un commento", () => {
	const comment = `<!-- ${csp} -->`;
	const alternate =
		"<meta content='font-src &apos;self&apos;' HTTP-EQUIV='Content-Security-Policy'>";
	const html = prefix + comment + resource + alternate + suffix;
	assert.equal(
		moveCspAfterCharset(html, "index.html"),
		prefix + alternate + comment + resource + suffix,
	);
});

test("rifiuta meta mancante, duplicato, fuori dal head e prefisso non verificabile", () => {
	for (const [html, reason] of [
		[prefix + suffix, /meta CSP mancante/],
		[prefix + csp + csp + suffix, /meta CSP duplicato/],
		[prefix + suffix.replace("<body>", `<body>${csp}`), /fuori dal head/],
		[prefix.replace("<head>", "<head></ignora>") + csp + suffix, /prefisso/],
		[
			prefix.replace("<head>", "<head><link rel=stylesheet href=/prima.css>") +
				csp +
				suffix,
			/prefisso/,
		],
		[`${prefix}<meta charset="utf-8">${csp}${suffix}`, /unico meta charset/],
	] as const) {
		assert.throws(
			() => moveCspAfterCharset(html, "en/index.html"),
			(error: Error) =>
				error.message.startsWith("en/index.html:") &&
				reason.test(error.message),
		);
	}
});
