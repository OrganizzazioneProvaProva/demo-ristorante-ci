import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import type { ImageMetadata } from "astro";
import { resolveLogo } from "./logo.ts";

const config = parseSiteConfig({
	slug: "t",
	schemaVersion: 1,
	languages: ["it", "en"],
});
const local = {
	src: "/_astro/logo.abc.svg",
	width: 240,
	height: 80,
	format: "svg",
} as ImageMetadata;
const studio = {
	asset: {
		url: "https://cdn.sanity.io/images/abc123/production/logo-480x160.png",
		width: 480,
		height: 160,
	},
	alt: { it: "Logo Ristorante X" },
};

describe("logo", () => {
	it("senza nessun logo: niente, il piè di pagina mostra il nome", () => {
		assert.equal(
			resolveLogo({ name: "Ristorante X", language: "it", config }),
			undefined,
		);
	});

	it("il logo dello Studio ha la precedenza", () => {
		const logo = resolveLogo({
			studio,
			local,
			name: "Ristorante X",
			language: "it",
			config,
		});
		assert.equal(logo?.url, studio.asset.url);
		assert.equal(logo?.local, undefined);
	});

	it("un file del sito (anche SVG) fa da logo, con il nome come testo alternativo, e non è un segnaposto", () => {
		for (const language of ["it", "en"] as const) {
			const logo = resolveLogo({
				local,
				name: "Ristorante X",
				language,
				config,
			});
			assert.equal(logo?.alt, "Ristorante X");
			assert.equal(logo?.placeholder, false);
			assert.equal(logo?.local, local);
			assert.equal(logo?.lang, undefined);
		}
	});
});
