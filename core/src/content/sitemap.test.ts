import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import { withLegalPages } from "./legal.ts";
import { sitemapEndpoint, sitemapXml } from "./sitemap.ts";

const config = parseSiteConfig({
	slug: "t",
	schemaVersion: 1,
	languages: ["it", "en"],
});
const site = "https://demo.example";

describe("sitemap", () => {
	const pages = withLegalPages(
		[
			{
				id: "home",
				slug: "home",
				language: "it" as const,
				path: "/",
				title: "H",
				description: "d",
			},
			{
				id: "home",
				slug: "home",
				language: "en" as const,
				path: "/en/",
				title: "H",
				description: "d",
			},
			{
				id: "solo",
				slug: "solo-it",
				language: "it" as const,
				path: "/solo-it/",
				title: "S",
				description: "d",
			},
		],
		config,
	);
	const xml = sitemapXml(pages, config, site);

	it("elenca ogni pagina con indirizzo assoluto", () => {
		assert.match(xml, /<loc>https:\/\/demo\.example\/<\/loc>/);
		assert.match(xml, /<loc>https:\/\/demo\.example\/en\/<\/loc>/);
		assert.match(xml, /<loc>https:\/\/demo\.example\/privacy\/<\/loc>/);
		assert.match(xml, /<loc>https:\/\/demo\.example\/en\/cookie\/<\/loc>/);
		assert.equal((xml.match(/<url>/g) ?? []).length, pages.length);
	});

	it("le pagine in due lingue hanno gli alternativi, con x-default", () => {
		assert.match(
			xml,
			/<loc>https:\/\/demo\.example\/<\/loc><xhtml:link rel="alternate" hreflang="it" href="https:\/\/demo\.example\/"\/><xhtml:link rel="alternate" hreflang="en" href="https:\/\/demo\.example\/en\/"\/><xhtml:link rel="alternate" hreflang="x-default" href="https:\/\/demo\.example\/"\/>/,
		);
	});

	it("una pagina in una lingua sola non ha alternativi", () => {
		assert.match(xml, /<loc>https:\/\/demo\.example\/solo-it\/<\/loc><\/url>/);
	});

	it("esclude 404 e pagine marcate noindex sia dalle loc sia dagli alternativi", () => {
		const [home, english] = pages;
		const xml = sitemapXml(
			[
				home,
				{ ...english, noindex: true },
				{ ...home, id: "error", slug: "404", path: "/404.html" },
				{ ...english, id: "error", slug: "error", path: "/en/404.html" },
			],
			config,
			site,
		);
		assert.match(xml, /<loc>https:\/\/demo\.example\/<\/loc><\/url>/);
		assert.equal((xml.match(/<url>/g) ?? []).length, 1);
		assert.doesNotMatch(xml, /<xhtml:link|404\.html|\/en\//);
	});

	it("produce la stessa risposta XML per allow e salta la rotta in modalità block", async () => {
		const published = sitemapEndpoint(pages, config);
		assert.deepEqual(published.getStaticPaths(), [
			{ params: { format: "xml" } },
		]);
		const response = published.GET({ site: new URL(site) });
		assert.equal(response.headers.get("content-type"), "application/xml");
		assert.equal(await response.text(), xml);
		assert.throws(() => published.GET({}), /Serve `site`.*sitemap/);
		assert.deepEqual(
			sitemapEndpoint(pages, { ...config, indexing: "block" }).getStaticPaths(),
			[],
		);
	});
});
