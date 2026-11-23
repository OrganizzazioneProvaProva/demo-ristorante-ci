import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import { alternatesFor, pagePath, resolvePages } from "./pages.ts";

const italianOnly = parseSiteConfig({ slug: "t", schemaVersion: 1 });
const bilingual = parseSiteConfig({
	slug: "t",
	schemaVersion: 1,
	languages: ["it", "en"],
});

const services = {
	_id: "p-services",
	slug: "servizi",
	title: { it: "Servizi", en: "Services" },
	description: { it: "Cosa facciamo", en: "What we do" },
};
const about = {
	_id: "p-about",
	slug: "chi-siamo",
	title: { it: "Chi siamo", en: "About us" },
	description: { it: "La nostra storia", en: "Our story" },
};

describe("percorsi", () => {
	it("l'italiano sta su / e l'inglese su /en/", () => {
		assert.equal(pagePath("it", "home", bilingual), "/");
		assert.equal(pagePath("en", "home", bilingual), "/en/");
		assert.equal(pagePath("it", "chi-siamo", bilingual), "/chi-siamo/");
		assert.equal(pagePath("en", "chi-siamo", bilingual), "/en/chi-siamo/");
	});
});

describe("resolvePages", () => {
	it("un sito solo italiano non genera pagine inglesi, anche se i dati le contengono", () => {
		const { pages, skipped } = resolvePages([services, about], italianOnly);
		assert.deepEqual(
			pages.map((p) => p.path),
			["/servizi/", "/chi-siamo/"],
		);
		assert.deepEqual(skipped, []);
	});

	it("un sito bilingue genera le pagine in entrambe le lingue", () => {
		const { pages } = resolvePages([services, about], bilingual);
		assert.deepEqual(
			pages.map((p) => p.path),
			["/servizi/", "/en/servizi/", "/chi-siamo/", "/en/chi-siamo/"],
		);
	});

	it("senza titolo inglese la pagina inglese non esiste e viene segnalata", () => {
		const noEnglishTitle = { ...about, title: { it: "Chi siamo", en: null } };
		const { pages, skipped } = resolvePages([noEnglishTitle], bilingual);
		assert.deepEqual(
			pages.map((p) => p.path),
			["/chi-siamo/"],
		);
		assert.deepEqual(skipped, [
			{
				id: "p-about",
				slug: "chi-siamo",
				language: "en",
				missing: ["title"],
				intentional: false,
			},
		]);
	});

	it("senza descrizione inglese la pagina inglese non esiste", () => {
		const noEnglishDescription = {
			...about,
			description: { it: "La nostra storia", en: "   " },
		};
		const { pages, skipped } = resolvePages([noEnglishDescription], bilingual);
		assert.equal(pages.length, 1);
		assert.deepEqual(skipped[0]?.missing, ["description"]);
	});

	it("se manca l'italiano (lingua principale) la build si ferma", () => {
		const noItalianTitle = { ...about, title: { it: "", en: "About us" } };
		assert.throws(
			() => resolvePages([noItalianTitle], bilingual),
			/lingua principale/,
		);
	});

	it("lo slug home è riservato: una pagina non può usarlo (la home è il documento home)", () => {
		assert.throws(
			() => resolvePages([{ ...about, slug: "home" }], bilingual),
			/riservato/,
		);
	});

	it("con onlyDefaultLanguage la pagina esiste solo nella lingua principale, anche con l'inglese completo", () => {
		const choice = { ...about, onlyDefaultLanguage: true };
		const { pages, skipped } = resolvePages([choice], bilingual);
		assert.deepEqual(
			pages.map((page) => page.path),
			["/chi-siamo/"],
		);
		assert.deepEqual(skipped, [
			{
				id: "p-about",
				slug: "chi-siamo",
				language: "en",
				missing: [],
				intentional: true,
			},
		]);
	});

	it("senza il flag la stessa pagina con l'inglese mancante è una dimenticanza (intentional falso)", () => {
		const forgotten = { ...about, title: { it: "Chi siamo" } };
		assert.equal(
			resolvePages([forgotten], bilingual).skipped[0]?.intentional,
			false,
		);
	});

	it("con onlyDefaultLanguage la lingua principale resta obbligatoria", () => {
		const bad = { ...about, title: { it: "" }, onlyDefaultLanguage: true };
		assert.throws(() => resolvePages([bad], bilingual), /lingua principale/);
	});

	it("rifiuta slug duplicati e slug non validi", () => {
		assert.throws(
			() => resolvePages([about, { ...about, _id: "x" }], bilingual),
			/duplicato/,
		);
		assert.throws(() =>
			resolvePages([{ ...about, slug: "Chi Siamo" }], bilingual),
		);
	});
});

describe("alternatesFor", () => {
	it("elenca le due versioni e x-default verso l'italiano", () => {
		const { pages } = resolvePages([about], bilingual);
		const itPage = pages.find((p) => p.language === "it");
		assert.ok(itPage);
		assert.deepEqual(alternatesFor(itPage, pages, bilingual), [
			{ hreflang: "it", path: "/chi-siamo/" },
			{ hreflang: "en", path: "/en/chi-siamo/" },
			{ hreflang: "x-default", path: "/chi-siamo/" },
		]);
	});

	it("una pagina esistente solo in italiano non ha link hreflang", () => {
		const noEnglish = { ...about, title: { it: "Chi siamo" } };
		const { pages } = resolvePages([noEnglish], bilingual);
		const [only] = pages;
		assert.ok(only);
		assert.equal(pages.length, 1);
		assert.deepEqual(alternatesFor(only, pages, bilingual), []);
	});
});
