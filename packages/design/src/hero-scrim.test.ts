import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseDesignMd } from "./design-md.ts";
import {
	HERO_MIN_CONTRAST,
	HERO_SCRIM_PERCENT,
	heroScrimContrast,
} from "./hero-scrim.ts";

describe("velo dell'hero", () => {
	it("testo chiaro su palette scura passa su foto bianca, ma la foto nera è il caso peggiore", () => {
		const result = heroScrimContrast({ ink: "#0E2A47", bg: "#F4F7F5" });
		assert.ok(
			result.onWhite >= HERO_MIN_CONTRAST,
			`su bianco ${result.onWhite}`,
		);
		assert.ok(result.onBlack >= HERO_MIN_CONTRAST, `su nero ${result.onBlack}`);
		assert.equal(result.worst, Math.min(result.onWhite, result.onBlack));
	});

	it("un testo con poco contrasto rispetto all'ink non passa (controllo negativo)", () => {
		const result = heroScrimContrast({ ink: "#8899aa", bg: "#99aabb" });
		assert.ok(result.worst < HERO_MIN_CONTRAST);
	});

	it("ogni set di design del preset ristorante tiene il titolo leggibile", () => {
		const dir = new URL("../../../preset/ristorante/design/", import.meta.url);
		const files = readdirSync(dir).filter((name) => name.endsWith(".md"));
		assert.ok(files.length >= 3);
		for (const file of files) {
			const design = parseDesignMd(readFileSync(new URL(file, dir), "utf8"));
			const colors = design.tokens.colors;
			const { worst } = heroScrimContrast({ ink: colors.ink, bg: colors.bg });
			assert.ok(worst >= HERO_MIN_CONTRAST, `${file}: ${worst.toFixed(2)}`);
		}
	});

	it("la percentuale del velo scritta in Hero.astro è quella usata nel calcolo", () => {
		const hero = readFileSync(
			join(import.meta.dirname, "../../../core/src/components/Hero.astro"),
			"utf8",
		);
		assert.ok(
			hero.includes(`var(--t-ink)_${HERO_SCRIM_PERCENT}%`),
			"la classe del velo in Hero.astro non usa HERO_SCRIM_PERCENT",
		);
	});
});
