import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BUTTON_VARIANTS, buttonClasses } from "./button-classes.ts";

describe("buttonClasses", () => {
	it("il pulsante pieno usa accento e testo sull'accento, con hover derivato", () => {
		const classes = buttonClasses("primary");
		for (const name of [
			"bg-accent",
			"text-accent-ink",
			"hover:bg-accent-hover",
		]) {
			assert.ok(classes.split(" ").includes(name), `manca ${name}`);
		}
	});

	it("la variante predefinita è primary", () => {
		assert.equal(buttonClasses(), buttonClasses("primary"));
	});

	it("la variante secondaria non è un pulsante pieno", () => {
		assert.ok(!BUTTON_VARIANTS.secondary.includes("bg-accent"));
	});

	it("ha un'altezza minima per il tocco e non toglie il focus", () => {
		const classes = buttonClasses("primary");
		assert.match(classes, /\bmin-h-11\b/);
		assert.doesNotMatch(classes, /outline-(none|hidden)/);
	});
});
