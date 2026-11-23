import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDay, SECTION_LABELS } from "./section-labels.ts";

describe("SECTION_LABELS", () => {
	it("ogni lingua ha tutte le voci, non vuote; la scadenza ha il segnaposto", () => {
		const keys = Object.keys(SECTION_LABELS.it);
		for (const labels of Object.values(SECTION_LABELS)) {
			assert.deepEqual(Object.keys(labels), keys);
			assert.ok(Object.values(labels).every((text) => text.trim().length > 0));
			assert.match(labels.promotionUntil, /\{date\}/);
		}
		assert.notEqual(SECTION_LABELS.en.gallery, SECTION_LABELS.it.gallery);
	});
});

describe("formatDay", () => {
	it("scrive il giorno per esteso nella lingua, senza spostamenti di fuso", () => {
		assert.equal(formatDay("2026-11-30", "it"), "30 novembre 2026");
		assert.equal(formatDay("2026-11-30", "en"), "30 November 2026");
		assert.equal(formatDay("2027-01-01", "it"), "1 gennaio 2027");
	});
});
