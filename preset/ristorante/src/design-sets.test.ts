import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { COLOR_ROLES, parseDesignMd } from "@siti/design";

/** Tonalità (0-360), saturazione e luminosità (0-1) di un colore #rrggbb. */
function hsl(hex: string): { h: number; s: number; l: number } {
	const value = Number.parseInt(hex.slice(1), 16);
	const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map(
		(c) => c / 255,
	) as [number, number, number];
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	const l = (max + min) / 2;
	if (d === 0) return { h: 0, s: 0, l };
	const s = d / (1 - Math.abs(2 * l - 1));
	const h =
		max === r
			? ((g - b) / d) % 6
			: max === g
				? (b - r) / d + 2
				: (r - g) / d + 4;
	return { h: (h * 60 + 360) % 360, s, l };
}

/** Sfondo chiaro dal colore caldo e giallastro, tipo "crema". */
const isCream = (hex: string) => {
	const { h, s, l } = hsl(hex);
	return h >= 25 && h <= 60 && s >= 0.15 && l >= 0.85;
};

/** Rosso-arancio caldo e saturo, tipo "terracotta". */
const isTerracotta = (hex: string) => {
	const { h, s, l } = hsl(hex);
	return h >= 5 && h <= 25 && s >= 0.45 && l >= 0.4 && l <= 0.7;
};

const dir = new URL("../design/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
const sets = files.map((file) => ({
	file,
	parsed: parseDesignMd(readFileSync(new URL(file, dir), "utf8")),
}));

describe("insiemi di design del preset ristorante", () => {
	it("ci sono le tre direzioni, tutte valide e con i contrasti verificati", () => {
		assert.deepEqual(files.sort(), [
			"basilico.md",
			"maiolica.md",
			"oliva-pietra.md",
		]);
		for (const { file, parsed } of sets) {
			assert.ok(
				parsed.findings.every((f) => f.passes),
				file,
			);
			assert.deepEqual(
				Object.keys(parsed.tokens.colors).sort(),
				[...COLOR_ROLES].sort(),
				file,
			);
		}
	});

	it("sono davvero diverse tra loro (colori e font)", () => {
		const accents = new Set(sets.map((s) => s.parsed.tokens.colors.accent));
		const displays = new Set(
			sets.map((s) => s.parsed.tokens.typography.display.fontFamily),
		);
		assert.equal(accents.size, 3);
		assert.equal(displays.size, 3);
	});

	it('il rilevatore di "crema + terracotta" riconosce la coppia di frontend-design (non è vuoto)', () => {
		// #F4F1EA con #D97757 è l'esempio che frontend-design cita come tic dei siti generati.
		assert.equal(isCream("#F4F1EA"), true);
		assert.equal(isTerracotta("#D97757"), true);
		// e non scatta su colori che crema e terracotta non sono
		assert.equal(isCream("#0F2318"), false);
		assert.equal(isCream("#F4F7F5"), false);
		assert.equal(isTerracotta("#1D5FBF"), false);
	});

	it("nessuna delle tre direzioni usa la combinazione crema + terracotta", () => {
		for (const { file, parsed } of sets) {
			const { bg, surface, accent } = parsed.tokens.colors;
			assert.equal(
				(isCream(bg) || isCream(surface)) && isTerracotta(accent),
				false,
				file,
			);
		}
	});
});
