import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import { rawContactsSchema, resolveSiteBooking } from "./contacts.ts";
import { rawHomeSchema, resolveHome } from "./home.ts";
import { rawPromotionSchema, resolvePromotions } from "./promotions.ts";

const site = parseSiteConfig({ slug: "ristorante", schemaVersion: 1 });
const demo = parseSiteConfig({
	...site,
	slug: "demo-test",
	kind: "demo",
	indexing: "block",
});
const title = { it: "Titolo" };
const home = (sourceUrl: string) => ({
	title,
	description: title,
	heroTitle: title,
	socialProof: { rating: 5, sourceName: "Recensioni", sourceUrl },
});
const promotion = (link: string) => ({ _id: "p", title, link });
const resolves = (link: string, config: typeof site) => [
	resolveSiteBooking(config, { bookingUrl: link }, "/contatti/").href,
	resolveHome(home(link), "it", config)?.socialProof?.sourceUrl,
	resolvePromotions([promotion(link)], "it", "2026-11-18", config).items[0]
		?.link,
];

describe("destinazioni dei contenuti", () => {
	it("i tre schemi rifiutano credenziali, host locali e sintassi ambigua", () => {
		for (const link of [
			"https://google.com@evil.example/",
			"https://@thefork.it/",
			"https://127.0.0.1/x",
			"https://2130706433/x",
			"https://[::1]/x",
			"https://localhost/x",
			"https://localhost./",
			"https:///x",
			"https://thefork.it\\x",
			"https://thefork.it/\tx",
			"https://thefork.it/\nx",
			"https://thefork.it/\u007fx",
		]) {
			assert.equal(
				rawContactsSchema.safeParse({ bookingUrl: link }).success,
				false,
				link,
			);
			assert.equal(rawHomeSchema.safeParse(home(link)).success, false, link);
			assert.equal(
				rawPromotionSchema.safeParse(promotion(link)).success,
				false,
				link,
			);
		}
	});

	it("i resolver delle tre destinazioni applicano il tipo del sito", () => {
		for (const suffix of ["example", "test", "invalid", "localhost", "TEST."]) {
			const link = `https://prenota.${suffix}/x`;
			assert.throws(
				() => resolveSiteBooking(site, { bookingUrl: link }, "/contatti/"),
				/contacts\.bookingUrl/,
			);
			assert.throws(
				() => resolveHome(home(link), "it", site),
				/home\.socialProof\.sourceUrl/,
			);
			assert.throws(
				() => resolvePromotions([promotion(link)], "it", "2026-11-18", site),
				/promotion\.link/,
			);
			assert.deepEqual(resolves(link, demo), [link, link, link]);
		}
	});

	it("la lista controlla corrispondenze esatte e sottodomini per tutti i resolver", () => {
		const config = { ...site, links: { allowedHosts: ["thefork.it"] } };
		for (const link of [
			"https://THefork.it/a",
			"https://booking.thefork.it/x",
		]) {
			assert.deepEqual(resolves(link, config), [link, link, link]);
		}
		const link = "https://evilthefork.it/";
		assert.throws(
			() => resolveSiteBooking(config, { bookingUrl: link }, "/contatti/"),
			/contacts\.bookingUrl.*evilthefork\.it.*thefork\.it/,
		);
		assert.throws(
			() => resolveHome(home(link), "it", config),
			/home\.socialProof\.sourceUrl.*evilthefork\.it.*thefork\.it/,
		);
		assert.throws(
			() =>
				resolvePromotions(
					[{ ...promotion(link), validTo: "2026-01-01" }],
					"it",
					"2026-11-18",
					config,
				),
			/promotion\.link.*evilthefork\.it.*thefork\.it/,
		);
		assert.deepEqual(resolves(link, site), [link, link, link]);
	});

	it("valida e compone mailto, conservando i link tel", () => {
		assert.equal(
			rawPromotionSchema.safeParse(promotion("mailto:a@b.it?cc=c@d.it"))
				.success,
			false,
		);
		const resolve = (link: string) =>
			resolvePromotions([promotion(link)], "it", "2026-11-18", site).items[0]
				?.link;
		assert.equal(resolve("mailto:a+b@b.it, c@d.it"), "mailto:a+b@b.it,c@d.it");
		assert.equal(resolve("tel:+39 0935 000000"), "tel:+39 0935 000000");
	});
});
