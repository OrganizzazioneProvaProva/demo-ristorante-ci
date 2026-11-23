import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import { resolveTestimonials } from "./testimonials.ts";

const config = parseSiteConfig({
	slug: "t",
	schemaVersion: 1,
	languages: ["it", "en"],
});

const list = [
	{
		_id: "a",
		author: "Giulia Rossi",
		role: { it: "Cliente abituale", en: "Regular customer" },
		rating: 5,
		text: { it: "Pizza fantastica.", en: "Fantastic pizza." },
	},
	{
		_id: "b",
		author: "élodie Martin",
		text: { it: "Serata perfetta." },
	},
];

describe("testimonianze", () => {
	it("nella lingua, con iniziale, ruolo e stelle", () => {
		const [first] = resolveTestimonials(list, "en", config);
		assert.equal(first?.text, "Fantastic pizza.");
		assert.equal(first?.role, "Regular customer");
		assert.equal(first?.rating, 5);
		assert.equal(first?.initial, "G");
		assert.equal(first?.textLang, undefined);
	});

	it("senza traduzione mostra il testo originale con la sua lingua, non lo traduce", () => {
		const second = resolveTestimonials(list, "en", config)[1];
		assert.equal(second?.text, "Serata perfetta.");
		assert.equal(second?.textLang, "it");
		assert.equal(second?.role, undefined);
		assert.equal(second?.rating, undefined);
		assert.equal(second?.initial, "É");
	});

	it("senza testo nella lingua principale la build si ferma", () => {
		assert.throws(
			() =>
				resolveTestimonials(
					[{ _id: "x", author: "Anna", text: { en: "only english" } }],
					"it",
					config,
				),
			/lingua principale.*si ferma/,
		);
	});

	it("le stelle sono da 1 a 5 e intere; l'autore è obbligatorio", () => {
		for (const rating of [0, 6, 4.5]) {
			assert.throws(() =>
				resolveTestimonials([{ ...list[0], rating }], "it", config),
			);
		}
		assert.throws(() =>
			resolveTestimonials(
				[{ _id: "z", author: " ", text: { it: "x" } }],
				"it",
				config,
			),
		);
	});

	it("una lista vuota è una lista vuota", () => {
		assert.deepEqual(resolveTestimonials([], "it", config), []);
	});
});
