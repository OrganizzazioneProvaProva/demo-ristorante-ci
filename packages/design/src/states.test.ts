import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { contrastRatio } from "./contrast.ts";
import { checkContrast, parseDesignMd } from "./design-md.ts";
import { themeCss } from "./output.ts";
import { deriveStates, mixHex } from "./states.ts";

const PRESETS = ["maiolica", "basilico", "oliva-pietra"];
const preset = (name: string) =>
	parseDesignMd(
		readFileSync(
			new URL(`../../../preset/ristorante/design/${name}.md`, import.meta.url),
			"utf8",
		),
	);

describe("mixHex", () => {
	it("miscela in sRGB: 0 e 1 danno gli estremi, 0,5 il punto medio", () => {
		assert.equal(mixHex("#000000", "#ffffff", 0), "#000000");
		assert.equal(mixHex("#000000", "#ffffff", 1), "#ffffff");
		assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
	});

	it("rifiuta un colore che non è #rrggbb", () => {
		assert.throws(() => mixHex("rosso", "#ffffff", 0.5), /#rrggbb/);
	});

	it("rifiuta un peso fuori da 0-1 o non numerico", () => {
		assert.throws(() => mixHex("#000000", "#ffffff", 2), RangeError);
		assert.throws(() => mixHex("#000000", "#ffffff", -0.1), RangeError);
		assert.throws(() => mixHex("#000000", "#ffffff", Number.NaN), RangeError);
	});
});

describe("deriveStates", () => {
	const base = {
		ink: "#0e2a47",
		surface: "#ffffff",
		accent: "#1d5fbf",
		"accent-ink": "#ffffff",
	};

	it("testo chiaro su accento scuro: l'hover si scurisce e il contrasto sale", () => {
		const { "accent-hover": hover } = deriveStates(base);
		assert.notEqual(hover, base.accent);
		assert.ok(
			contrastRatio("#ffffff", hover) > contrastRatio("#ffffff", base.accent),
		);
	});

	it("testo scuro su accento chiaro: l'hover si schiarisce e il contrasto sale", () => {
		const light = { ...base, accent: "#f2c230", "accent-ink": "#0e2a47" };
		const { "accent-hover": hover } = deriveStates(light);
		assert.ok(
			contrastRatio("#0e2a47", hover) > contrastRatio("#0e2a47", light.accent),
		);
	});
});

describe("l'hover non peggiora mai il contrasto", () => {
	const darkPalette = {
		ink: "#f2efe6",
		surface: "#14231b",
		accent: "#2e6b4a",
		"accent-ink": "#ffffff",
	};

	for (const name of PRESETS) {
		it(`${name}: il contrasto in hover è almeno quello a riposo`, () => {
			const colors = preset(name).tokens.colors as Record<string, string>;
			const { "accent-hover": hover } = deriveStates(colors);
			const rest = contrastRatio(
				colors["accent-ink"] as string,
				colors.accent as string,
			);
			const hovered = contrastRatio(colors["accent-ink"] as string, hover);
			assert.ok(
				hovered >= rest,
				`${name}: ${rest.toFixed(2)} → ${hovered.toFixed(2)}`,
			);
		});
	}

	it("palette scura con testo chiaro: l'hover si scurisce verso il più scuro, non verso un 'ink' chiaro", () => {
		const { "accent-hover": hover } = deriveStates(darkPalette);
		assert.ok(
			contrastRatio("#ffffff", hover) >=
				contrastRatio("#ffffff", darkPalette.accent),
		);
	});

	it("se né ink né surface sono più scuri dell'accento, si scurisce verso il nero", () => {
		const palette = {
			ink: "#eeeeee",
			surface: "#ffffff",
			accent: "#2e6b4a",
			"accent-ink": "#ffffff",
		};
		const { "accent-hover": hover } = deriveStates(palette);
		assert.ok(
			contrastRatio("#ffffff", hover) >
				contrastRatio("#ffffff", palette.accent),
		);
	});

	it("se né ink né surface sono più chiari dell'accento, si schiarisce verso il bianco", () => {
		const palette = {
			ink: "#111111",
			surface: "#222222",
			accent: "#f2c230",
			"accent-ink": "#0e2a47",
		};
		const { "accent-hover": hover } = deriveStates(palette);
		assert.ok(
			contrastRatio("#0e2a47", hover) >
				contrastRatio("#0e2a47", palette.accent),
		);
	});
});

describe("stati nei contrasti e nel CSS generato", () => {
	for (const name of PRESETS) {
		it(`${name}: l'hover del pulsante supera 4,5:1 ed è controllato`, () => {
			const { tokens } = preset(name);
			const finding = checkContrast(tokens).find(
				(item) => item.name === "Testo sul pulsante (hover)",
			);
			assert.ok(finding, "manca il controllo dell'hover");
			assert.ok(finding.passes, `${name}: ${finding.ratio.toFixed(2)}:1`);
		});
	}

	it("scrive --t-accent-hover nel CSS dei valori", () => {
		const { tokens } = preset("maiolica");
		assert.match(themeCss(tokens), /--t-accent-hover: #[0-9a-f]{6};/);
	});
});
