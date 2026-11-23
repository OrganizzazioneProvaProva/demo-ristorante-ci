import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import { isActiveOn, resolveNotices, resolvePromotions } from "./promotions.ts";

const config = parseSiteConfig({
	slug: "t",
	schemaVersion: 1,
	languages: ["it", "en"],
});
const img = "https://cdn.sanity.io/images/a9fpp237/production/abc-800x600.jpg";

const promo = (over: object = {}) => ({
	_id: "p1",
	title: { it: "Pizza e birra a 12 €", en: "Pizza and beer for 12 €" },
	description: { it: "Il martedì a cena." },
	validFrom: "2026-11-01",
	validTo: "2026-12-31",
	...over,
});

describe("validità nel tempo", () => {
	it("gli estremi sono compresi; senza estremi è sempre valida", () => {
		const range = { validFrom: "2026-11-01", validTo: "2026-12-31" };
		assert.equal(isActiveOn(range, "2026-11-01"), true);
		assert.equal(isActiveOn(range, "2026-12-31"), true);
		assert.equal(isActiveOn(range, "2026-10-31"), false);
		assert.equal(isActiveOn(range, "2027-01-01"), false);
		assert.equal(isActiveOn({}, "2030-01-01"), true);
		assert.equal(isActiveOn({ validTo: "2026-12-31" }, "2020-01-01"), true);
	});
});

describe("promozioni", () => {
	it("mostra solo quelle attive oggi", () => {
		const raw = [
			promo(),
			promo({ _id: "old", validFrom: "2026-09-01", validTo: "2026-10-31" }),
			promo({ _id: "future", validFrom: "2027-01-01", validTo: "2027-01-31" }),
		];
		const { items } = resolvePromotions(raw, "it", "2026-11-18", config);
		assert.deepEqual(
			items.map((i) => i.id),
			["p1"],
		);
		assert.equal(items[0]?.validTo, "2026-12-31");
	});

	it("la descrizione è facoltativa e non ha ripiego: in inglese manca e basta", () => {
		const en = resolvePromotions([promo()], "en", "2026-11-18", config)
			.items[0];
		assert.equal(en?.title, "Pizza and beer for 12 €");
		assert.equal(en?.description, undefined);
	});

	it("senza titolo inglese la promozione non esiste in inglese; senza italiano la build si ferma", () => {
		const noEn = promo({ title: { it: "Solo italiano" } });
		const result = resolvePromotions([noEn], "en", "2026-11-18", config);
		assert.deepEqual(result.items, []);
		assert.deepEqual(result.skipped, [
			{ id: "p1", language: "en", missing: "title", intentional: false },
		]);
		assert.throws(
			() =>
				resolvePromotions(
					[promo({ title: { en: "x" } })],
					"it",
					"2026-11-18",
					config,
				),
			/lingua principale/,
		);
	});

	it("l'immagine senza testo alternativo italiano blocca la build", () => {
		const bad = promo({ image: { asset: { url: img } } });
		assert.throws(
			() => resolvePromotions([bad], "it", "2026-11-18", config),
			/testo alternativo/,
		);
		const ok = promo({
			image: { asset: { url: img }, alt: { it: "Una pizza" } },
		});
		assert.equal(
			resolvePromotions([ok], "it", "2026-11-18", config).items[0]?.image?.alt,
			"Una pizza",
		);
	});

	it("senza alt inglese l'immagine resta, con alt italiano e lang=it", () => {
		const ok = promo({
			image: { asset: { url: img }, alt: { it: "Una pizza" } },
		});
		const image = resolvePromotions([ok], "en", "2026-11-18", config).items[0]
			?.image;
		assert.equal(image?.alt, "Una pizza");
		assert.equal(image?.lang, "it");
	});

	it("accetta solo link https, mailto e tel", () => {
		for (const link of [
			"https://example.com/x",
			"mailto:a@b.it",
			"tel:+39 0935 000000",
		]) {
			assert.doesNotThrow(
				() => resolvePromotions([promo({ link })], "it", "2026-11-18", config),
				link,
			);
		}
		for (const link of [
			"javascript:alert(1)",
			"http://example.com",
			"data:text/html,x",
		]) {
			assert.throws(
				() => resolvePromotions([promo({ link })], "it", "2026-11-18", config),
				link,
			);
		}
	});

	it("rifiuta date incoerenti", () => {
		assert.throws(() =>
			resolvePromotions(
				[promo({ validFrom: "2026-12-31", validTo: "2026-11-01" })],
				"it",
				"2026-11-18",
				config,
			),
		);
	});
});

describe("avvisi", () => {
	it("mostra il messaggio nella lingua, solo se valido oggi", () => {
		const raw = [
			{
				_id: "n1",
				message: {
					it: "Chiusi per il ponte",
					en: "Closed for the long weekend",
				},
				validTo: "2026-11-20",
			},
			{ _id: "n2", message: { it: "Scaduto" }, validTo: "2026-11-01" },
		];
		assert.deepEqual(resolveNotices(raw, "it", "2026-11-18", config).items, [
			{ id: "n1", message: "Chiusi per il ponte", validTo: "2026-11-20" },
		]);
		assert.deepEqual(resolveNotices(raw, "en", "2026-11-18", config).items, [
			{
				id: "n1",
				message: "Closed for the long weekend",
				validTo: "2026-11-20",
			},
		]);
		assert.deepEqual(resolveNotices(raw, "it", "2026-11-21", config).items, []);
	});

	it("senza messaggio inglese non compare in inglese", () => {
		const raw = [{ _id: "n1", message: { it: "Chiusi" } }];
		assert.deepEqual(resolveNotices(raw, "en", "2026-11-18", config).items, []);
	});

	it("«solo nella lingua principale»: l'avviso urgente esce subito in italiano e non in inglese, anche se tradotto", () => {
		const raw = [
			{
				_id: "n1",
				message: { it: "Oggi chiuso", en: "Closed today" },
				onlyDefaultLanguage: true,
			},
		];
		assert.deepEqual(resolveNotices(raw, "it", "2026-11-18", config).items, [
			{ id: "n1", message: "Oggi chiuso" },
		]);
		const en = resolveNotices(raw, "en", "2026-11-18", config);
		assert.deepEqual(en.items, []);
		assert.deepEqual(en.skipped, [
			{ id: "n1", language: "en", intentional: true },
		]);
	});

	it("senza il flag la traduzione mancante è una dimenticanza (intentional falso)", () => {
		const raw = [{ _id: "n1", message: { it: "Oggi chiuso" } }];
		assert.equal(
			resolveNotices(raw, "en", "2026-11-18", config).skipped[0]?.intentional,
			false,
		);
	});

	it("con il flag il messaggio in italiano resta obbligatorio", () => {
		const raw = [
			{ _id: "n1", message: { en: "Closed" }, onlyDefaultLanguage: true },
		];
		assert.throws(
			() => resolveNotices(raw, "it", "2026-11-18", config),
			/lingua principale/,
		);
	});
});

describe("promozioni: «solo nella lingua principale»", () => {
	it("la promozione con il flag non compare in inglese nemmeno se tradotta", () => {
		const raw = [
			{
				_id: "p1",
				title: { it: "Menu del giorno", en: "Menu of the day" },
				onlyDefaultLanguage: true,
			},
		];
		assert.equal(
			resolvePromotions(raw, "it", "2026-11-18", config).items.length,
			1,
		);
		const en = resolvePromotions(raw, "en", "2026-11-18", config);
		assert.deepEqual(en.items, []);
		assert.deepEqual(en.skipped, [
			{ id: "p1", language: "en", intentional: true },
		]);
	});

	it("le date di validità passano al risultato (il browser nasconde ciò che scade)", () => {
		const raw = [
			{
				_id: "p1",
				title: { it: "Offerta" },
				validFrom: "2026-11-10",
				validTo: "2026-11-30",
			},
		];
		const [item] = resolvePromotions(raw, "it", "2026-11-18", config).items;
		assert.equal(item?.validFrom, "2026-11-10");
		assert.equal(item?.validTo, "2026-11-30");
	});
});
