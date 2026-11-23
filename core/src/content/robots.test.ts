import assert from "node:assert/strict";
import { test } from "node:test";
import { robotsResponse } from "./robots.ts";

const site = new URL("https://azienda.example");
const rules = "User-agent: *\nAllow: /\n";

test("robots allow annuncia la sitemap assoluta", async () => {
	const response = robotsResponse({ indexing: "allow" }, site);
	assert.equal(
		response.headers.get("content-type"),
		"text/plain; charset=utf-8",
	);
	assert.equal(
		await response.text(),
		`${rules}Sitemap: https://azienda.example/sitemap.xml\n`,
	);
});

test("robots block lascia leggere noindex e omette la sitemap", async () => {
	assert.equal(await robotsResponse({ indexing: "block" }, site).text(), rules);
});

test("robots richiede site anche in modalità block", () => {
	for (const indexing of ["allow", "block"] as const) {
		assert.throws(
			() => robotsResponse({ indexing }),
			/Serve `site`.*robots.txt/,
		);
	}
});
