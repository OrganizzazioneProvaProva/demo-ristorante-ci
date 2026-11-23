import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MENU_LABELS, withMenuAction } from "./menu-labels.ts";

describe("MENU_LABELS", () => {
	it("ogni lingua ha tutte le voci, non vuote", () => {
		const keys = Object.keys(MENU_LABELS.it);
		for (const labels of Object.values(MENU_LABELS)) {
			assert.deepEqual(Object.keys(labels), keys);
			assert.ok(Object.values(labels).every((text) => text.trim().length > 0));
		}
		assert.notEqual(MENU_LABELS.en.vegan, MENU_LABELS.it.vegan);
	});
});

describe("withMenuAction", () => {
	const actions = [
		{ label: "Chiama", href: "tel:+390935000000" },
		{ label: "Mappa", href: "https://maps.example" },
	];

	it("mette Menu dopo la prima azione (il pulsante pieno)", () => {
		assert.deepEqual(
			withMenuAction(actions, "it", "/menu/").map((a) => a.label),
			["Chiama", "Menu", "Mappa"],
		);
		assert.equal(withMenuAction(actions, "it", "/menu/")[1]?.href, "/menu/");
	});

	it("senza altre azioni Menu è l'unica; non modifica l'elenco originale", () => {
		assert.deepEqual(withMenuAction([], "en", "/en/menu/"), [
			{ label: "Menu", href: "/en/menu/" },
		]);
		assert.equal(actions.length, 2);
	});
});
