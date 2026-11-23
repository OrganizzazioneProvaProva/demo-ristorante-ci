import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import { rawHomeSchema, resolveHome } from "./home.ts";

const config = parseSiteConfig({
	slug: "t",
	schemaVersion: 1,
	languages: ["it", "en"],
});
const photo = "https://cdn.sanity.io/images/a9fpp237/production/h-800x600.jpg";
const seo = {
	title: { it: "Pizzeria da Mario", en: "Mario's Pizzeria" },
	description: {
		it: "Pizza a Piazza Armerina",
		en: "Pizza in Piazza Armerina",
	},
};
const home = {
	...seo,
	heroTitle: { it: "Pizza al forno a legna", en: "Wood-fired pizza" },
	heroSubtitle: { it: "Dal 1980", en: "Since 1980" },
	heroImage: { asset: { url: photo }, alt: { it: "Il forno", en: "The oven" } },
	storyTitle: { it: "La nostra storia" },
	storyText: { it: "Siamo una famiglia.", en: "We are a family." },
	socialProof: {
		rating: 4.7,
		reviewCount: 120,
		sourceName: "Google",
		sourceUrl: "https://example.com/recensioni",
	},
};

describe("home", () => {
	it("restituisce testi, foto e valutazione nella lingua richiesta", () => {
		const it = resolveHome(home, "it", config);
		assert.equal(it?.hero.title, "Pizza al forno a legna");
		assert.equal(it?.hero.subtitle, "Dal 1980");
		assert.equal(it?.hero.image?.alt, "Il forno");
		assert.deepEqual(it?.story, {
			title: "La nostra storia",
			text: "Siamo una famiglia.",
		});
		assert.equal(it?.socialProof?.rating, 4.7);
	});

	it("in inglese: titolo della storia mancante resta assente, nessun ripiego", () => {
		const en = resolveHome(home, "en", config);
		assert.equal(en?.hero.title, "Wood-fired pizza");
		assert.deepEqual(en?.story, { text: "We are a family." });
	});

	it("senza titolo italiano la build si ferma; senza titolo inglese la home inglese non esiste", () => {
		assert.throws(
			() => resolveHome({ ...home, heroTitle: { en: "x" } }, "it", config),
			/titolo principale/,
		);
		assert.equal(
			resolveHome({ ...home, heroTitle: { it: "x" } }, "en", config),
			undefined,
		);
	});

	it("solo il titolo è obbligatorio: sottotitolo, foto, storia e valutazione sono facoltativi", () => {
		const minimal = resolveHome(
			{ ...seo, heroTitle: { it: "Ciao" } },
			"it",
			config,
		);
		assert.deepEqual(minimal, { hero: { title: "Ciao" } });
	});

	it("la valutazione: da 1 a 5 con un decimale, link solo https, fonte obbligatoria", () => {
		const bad = (extra: object) =>
			rawHomeSchema.safeParse({
				...home,
				socialProof: { ...home.socialProof, ...extra },
			}).success;
		assert.equal(bad({}), true);
		assert.equal(bad({ rating: 0.9 }), false);
		assert.equal(bad({ rating: 5.1 }), false);
		assert.equal(bad({ rating: 4.75 }), false);
		assert.equal(bad({ sourceUrl: "http://example.com" }), false);
		assert.equal(bad({ sourceUrl: "javascript:alert(1)" }), false);
		assert.equal(bad({ sourceName: " " }), false);
		assert.equal(bad({ reviewCount: 0 }), false);
	});
});
