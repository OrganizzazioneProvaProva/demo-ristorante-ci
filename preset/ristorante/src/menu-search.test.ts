import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchesAll } from "@siti/core/content/search.ts";
import type { ResolvedItem } from "./menu.ts";
import { itemSearchText } from "./menu-search.ts";

const item = (overrides: Partial<ResolvedItem> = {}): ResolvedItem => ({
	name: "Pasta alla Norma",
	description: "Melanzane fritte e ricotta salata",
	components: ["Pomodoro", "Basilico"],
	price: 11,
	allergens: {
		status: "listed",
		allergens: [
			{ code: "gluten", label: "Cereali contenenti glutine" },
			{ code: "milk", label: "Latte e lattosio" },
		],
	},
	diet: "vegetarian",
	featured: false,
	...overrides,
});

describe("testo di ricerca del piatto", () => {
	it("trova per nome, descrizione, dieta e allergene verificato", () => {
		const text = itemSearchText(item(), "it");
		for (const query of [
			"norma",
			"ricotta",
			"vegetariano",
			"glutine",
			"lattosio",
		]) {
			assert.ok(matchesAll(text, query), query);
		}
	});

	it("trova per componente anche se non è nella descrizione", () => {
		const text = itemSearchText(item(), "it");
		assert.ok(matchesAll(text, "basilico"));
		assert.ok(matchesAll(text, "pomodoro melanzane"));
	});

	it("trova più parole insieme, anche non vicine", () => {
		assert.ok(matchesAll(itemSearchText(item(), "it"), "melanzane salata"));
	});

	it("con allergeni non verificati non li indicizza (il sito non dichiara nulla)", () => {
		const text = itemSearchText(
			item({ allergens: { status: "ask-staff" } }),
			"it",
		);
		assert.equal(matchesAll(text, "glutine"), false);
		assert.equal(matchesAll(text, "latte"), false);
		assert.ok(matchesAll(text, "ricotta"));
	});

	it("usa le parole della lingua del sito", () => {
		const text = itemSearchText(
			item({ allergens: { status: "ask-staff" }, diet: "vegan" }),
			"en",
		);
		assert.ok(matchesAll(text, "vegan"));
		assert.equal(matchesAll(text, "vegano"), false);
	});

	it("senza descrizione indicizza comunque il nome", () => {
		assert.ok(
			matchesAll(
				itemSearchText(item({ description: undefined }), "it"),
				"norma",
			),
		);
	});
});
