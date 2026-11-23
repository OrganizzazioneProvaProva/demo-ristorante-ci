import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	matchesAll,
	normalizeSearchText,
	resultsText,
	SEARCH_LABELS,
	searchIndexText,
} from "./search.ts";

describe("normalizzazione", () => {
	it("toglie accenti, maiuscole e punteggiatura", () => {
		assert.equal(
			normalizeSearchText("Più  Gusto! Crème brûlée"),
			"piu gusto creme brulee",
		);
		assert.equal(normalizeSearchText("  "), "");
	});

	it("compone il testo di un elemento ignorando le parti assenti", () => {
		assert.equal(
			searchIndexText([
				"Pasta alla Norma",
				undefined,
				null,
				"",
				"melanzane, ricotta salata",
			]),
			"pasta alla norma melanzane ricotta salata",
		);
	});
});

describe("corrispondenza", () => {
	const item = searchIndexText([
		"Pasta alla Norma",
		"melanzane e ricotta salata",
	]);

	it("una ricerca vuota trova tutto", () => {
		assert.ok(matchesAll(item, ""));
		assert.ok(matchesAll(item, "   "));
	});

	it("trova per parole intere o parziali, senza badare ad accenti e maiuscole", () => {
		assert.ok(matchesAll(item, "RICOTTA"));
		assert.ok(matchesAll(item, "ricot"));
		assert.ok(matchesAll(item, "mélanzane"));
	});

	it("tutte le parole devono comparire, in qualunque ordine", () => {
		assert.ok(matchesAll(item, "salata norma"));
		assert.equal(matchesAll(item, "norma pesce"), false);
	});

	it("un testo che non c'è non trova nulla", () => {
		assert.equal(matchesAll(item, "cioccolato"), false);
	});
});

describe("testi dei risultati", () => {
	it("zero, uno e molti, nella lingua", () => {
		assert.equal(resultsText(0, SEARCH_LABELS.it), "Nessun risultato");
		assert.equal(resultsText(1, SEARCH_LABELS.it), "1 risultato");
		assert.equal(resultsText(3, SEARCH_LABELS.it), "3 risultati");
		assert.equal(resultsText(3, SEARCH_LABELS.en), "3 results");
		assert.equal(resultsText(0, SEARCH_LABELS.en), "No results");
	});

	it("ogni lingua ha tutte le voci, non vuote", () => {
		for (const labels of Object.values(SEARCH_LABELS)) {
			assert.ok(Object.values(labels).every((text) => text.trim().length > 0));
		}
	});
});
