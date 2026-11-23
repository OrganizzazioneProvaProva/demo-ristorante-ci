import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import { alternatesFor } from "./pages.ts";
import { createSitePages, resolveSitePages } from "./site-pages.ts";

const bilingual = parseSiteConfig({
	slug: "t",
	schemaVersion: 1,
	languages: ["it", "en"],
});
const italianOnly = parseSiteConfig({ slug: "t", schemaVersion: 1 });

const home = {
	title: { it: "Pizzeria da Mario", en: "Mario's Pizzeria" },
	description: {
		it: "Pizza a Piazza Armerina",
		en: "Pizza in Piazza Armerina",
	},
	heroTitle: { it: "Pizza al forno a legna", en: "Wood-fired pizza" },
};
const about = {
	_id: "p-about",
	slug: "chi-siamo",
	title: { it: "Chi siamo", en: "About us" },
	description: { it: "La nostra storia", en: "Our story" },
};

describe("createSitePages", () => {
	it("risolve contenuti, pagine legali e alternati nello stesso insieme", () => {
		const site = createSitePages(home, [about], bilingual);
		const { home: resolved, page, alternates } = site.homeFor("en");
		assert.equal(resolved.hero.title, "Wood-fired pizza");
		assert.equal(page.path, "/en/");
		assert.deepEqual(alternates, site.pageFor("home", "en").alternates);
		assert.equal(site.pageFor("privacy", "en").page.path, "/en/privacy/");
		assert.deepEqual(site.pageFor("privacy", "en").alternates, [
			{ hreflang: "it", path: "/privacy/" },
			{ hreflang: "en", path: "/en/privacy/" },
			{ hreflang: "x-default", path: "/privacy/" },
		]);
	});

	it("rifiuta i modelli richiesti per una lingua senza pagina", () => {
		const site = createSitePages(home, [about], italianOnly);
		assert.throws(() => site.homeFor("en"), /Home non disponibile in en/);
		assert.throws(
			() => site.pageFor("chi-siamo", "en"),
			/non disponibile in en/,
		);
	});
});

describe("resolveSitePages (home come pagina)", () => {
	it("la home entra con le altre pagine: / e /en/, con hreflang come ogni pagina", () => {
		const { pages, skipped } = resolveSitePages(home, [about], bilingual);
		assert.deepEqual(
			pages.map((page) => page.path),
			["/", "/en/", "/chi-siamo/", "/en/chi-siamo/"],
		);
		assert.deepEqual(skipped, []);
		const itHome = pages.find((page) => page.path === "/");
		assert.ok(itHome);
		assert.deepEqual(alternatesFor(itHome, pages, bilingual), [
			{ hreflang: "it", path: "/" },
			{ hreflang: "en", path: "/en/" },
			{ hreflang: "x-default", path: "/" },
		]);
	});

	it("un sito solo italiano ha solo la home italiana, anche se i dati hanno l'inglese", () => {
		const { pages } = resolveSitePages(home, [], italianOnly);
		assert.deepEqual(
			pages.map((page) => page.path),
			["/"],
		);
	});

	it("la home inglese esiste solo con titolo SEO, descrizione E titolo principale in inglese", () => {
		for (const [field, missing] of [
			["title", "title"],
			["description", "description"],
			["heroTitle", "heroTitle"],
		] as const) {
			const broken = { ...home, [field]: { it: home[field].it, en: null } };
			const { pages, skipped } = resolveSitePages(broken, [], bilingual);
			assert.deepEqual(
				pages.map((page) => page.path),
				["/"],
				field,
			);
			assert.deepEqual(skipped[0]?.missing, [missing], field);
			assert.equal(skipped[0]?.slug, "home");
		}
	});

	it("una home inglese saltata non lascia hreflang verso una pagina che non c'è", () => {
		const broken = { ...home, heroTitle: { it: "Pizza al forno a legna" } };
		const { pages } = resolveSitePages(broken, [], bilingual);
		const [only] = pages;
		assert.ok(only);
		assert.deepEqual(alternatesFor(only, pages, bilingual), []);
	});

	it("manca il titolo principale in italiano: la build si ferma, anche con onlyDefaultLanguage", () => {
		const broken = {
			...home,
			heroTitle: { it: "" },
			onlyDefaultLanguage: true,
		};
		assert.throws(
			() => resolveSitePages(broken, [], bilingual),
			/lingua principale/,
		);
	});

	it("con onlyDefaultLanguage la home esiste solo in italiano, anche con l'inglese completo, e non ha hreflang", () => {
		const choice = { ...home, onlyDefaultLanguage: true };
		const { pages, skipped } = resolveSitePages(choice, [], bilingual);
		assert.deepEqual(
			pages.map((page) => page.path),
			["/"],
		);
		assert.equal(skipped[0]?.intentional, true);
		const [only] = pages;
		assert.ok(only);
		assert.deepEqual(alternatesFor(only, pages, bilingual), []);
	});

	it("senza il flag una home inglese incompleta è una dimenticanza", () => {
		const forgotten = { ...home, heroTitle: { it: "Ciao" } };
		assert.equal(
			resolveSitePages(forgotten, [], bilingual).skipped[0]?.intentional,
			false,
		);
	});

	it("una page con slug home è rifiutata (slug riservato) e gli slug duplicati pure", () => {
		assert.throws(
			() => resolveSitePages(home, [{ ...about, slug: "home" }], bilingual),
			/riservato/,
		);
		assert.throws(
			() => resolveSitePages(home, [about, { ...about, _id: "x" }], bilingual),
			/duplicato/,
		);
	});
});
