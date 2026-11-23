import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { companyInfoSchema } from "@siti/core/content/company.ts";
import { restaurantJsonLd } from "./json-ld.ts";

const company = companyInfoSchema.parse({
	name: "Ristorante X",
	legalType: "ditta-individuale",
	vatNumber: "01234567897",
	address: {
		street: "Via Esempio 12",
		postalCode: "94015",
		city: "Piazza Armerina",
		province: "EN",
	},
});
const base = { company, url: "https://demo.example/", today: "2026-11-19" };

describe("restaurantJsonLd", () => {
	it("è un Restaurant di schema.org, con il tipo scelto se diverso", () => {
		assert.equal(restaurantJsonLd(base)["@type"], "Restaurant");
		assert.equal(
			restaurantJsonLd({ ...base, type: "BarOrPub" })["@type"],
			"BarOrPub",
		);
	});

	it("scrive cucina, menu e prenotazioni solo se i dati esistono", () => {
		const bare = restaurantJsonLd(base);
		for (const key of [
			"servesCuisine",
			"menu",
			"acceptsReservations",
			"priceRange",
			"image",
		]) {
			assert.ok(!(key in bare), `non deve esserci ${key}`);
		}
		const full = restaurantJsonLd({
			...base,
			cuisine: ["Pizza", "Sicilian"],
			menuUrl: "https://demo.example/menu/",
			bookingUrl: "https://prenota.example/x",
		});
		assert.deepEqual(full.servesCuisine, ["Pizza", "Sicilian"]);
		assert.equal(full.menu, "https://demo.example/menu/");
		assert.equal(full.acceptsReservations, "https://prenota.example/x");
	});

	it("un percorso del sito come bookingUrl non entra nel JSON-LD: la build si ferma", () => {
		assert.throws(
			() => restaurantJsonLd({ ...base, bookingUrl: "/contatti/#prenota" }),
			/https/,
		);
	});

	it("una lista di cucine vuota non scrive servesCuisine", () => {
		assert.ok(!("servesCuisine" in restaurantJsonLd({ ...base, cuisine: [] })));
	});
});
