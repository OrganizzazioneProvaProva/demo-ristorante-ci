import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	dateRangeError,
	findOverlap,
	intervalSpan,
	isValidMonthDay,
	isValidTime,
	isValidVatNumber,
	valueAtPath,
} from "./rules.ts";

describe("orari", () => {
	it("accetta solo HH:MM a 24 ore", () => {
		for (const ok of ["00:00", "09:30", "12:00", "23:59"]) {
			assert.ok(isValidTime(ok), ok);
		}
		for (const ko of ["24:00", "9:30", "12:60", "12.30", "", "mezzogiorno"]) {
			assert.ok(!isValidTime(ko), ko);
		}
		assert.ok(!isValidTime(undefined));
	});

	it("una chiusura dopo mezzanotte finisce il giorno dopo", () => {
		assert.deepEqual(
			intervalSpan({ opens: "12:00", closes: "15:00" }),
			[720, 900],
		);
		assert.deepEqual(
			intervalSpan({ opens: "19:00", closes: "01:00" }),
			[1140, 1500],
		);
		assert.equal(intervalSpan({ opens: "12:00" }), undefined);
	});

	it("riconosce fasce sovrapposte e accetta pranzo e cena", () => {
		assert.equal(
			findOverlap([
				{ opens: "12:00", closes: "15:00" },
				{ opens: "19:00", closes: "23:00" },
			]),
			undefined,
		);
		assert.ok(
			findOverlap([
				{ opens: "12:00", closes: "15:00" },
				{ opens: "14:00", closes: "16:00" },
			]),
		);
		assert.ok(
			findOverlap([
				{ opens: "19:00", closes: "01:00" },
				{ opens: "00:30", closes: "02:00" },
			]) === undefined,
			"la fascia dopo mezzanotte è del giorno dopo, non si confronta con questa",
		);
	});

	it("fasce che si toccano non si sovrappongono", () => {
		assert.equal(
			findOverlap([
				{ opens: "12:00", closes: "15:00" },
				{ opens: "15:00", closes: "18:00" },
			]),
			undefined,
		);
	});
});

describe("date", () => {
	it("giorno e mese devono esistere", () => {
		assert.ok(isValidMonthDay(12, 25));
		assert.ok(isValidMonthDay(2, 29));
		assert.ok(!isValidMonthDay(2, 30));
		assert.ok(!isValidMonthDay(4, 31));
		assert.ok(!isValidMonthDay(13, 1));
		assert.ok(!isValidMonthDay(1.5, 1));
	});

	it("la data finale non può precedere quella iniziale", () => {
		assert.equal(dateRangeError("2026-12-01", "2026-12-24"), undefined);
		assert.equal(dateRangeError("2026-12-01", "2026-12-01"), undefined);
		assert.ok(dateRangeError("2026-12-24", "2026-12-01"));
		assert.equal(dateRangeError(undefined, "2026-12-01"), undefined);
	});
});

describe("valueAtPath", () => {
	const doc = {
		image: { decorative: true },
		images: [
			{ _key: "a", decorative: false },
			{ _key: "b", decorative: true },
		],
	};

	it("legge campi, indici e elementi di array per _key", () => {
		assert.equal(valueAtPath(doc, ["image", "decorative"]), true);
		assert.equal(
			valueAtPath(doc, ["images", { _key: "b" }, "decorative"]),
			true,
		);
		assert.equal(
			valueAtPath(doc, ["images", { _key: "a" }, "decorative"]),
			false,
		);
		assert.equal(valueAtPath(doc, ["images", 0, "_key"]), "a");
	});

	it("un percorso inesistente dà undefined", () => {
		assert.equal(valueAtPath(doc, ["nope", "x"]), undefined);
		assert.equal(
			valueAtPath(doc, ["images", { _key: "zz" }, "decorative"]),
			undefined,
		);
		assert.equal(valueAtPath(doc, ["image", { _key: "a" }]), undefined);
		assert.equal(valueAtPath(undefined, ["a"]), undefined);
	});
});

describe("partita IVA", () => {
	it("accetta numeri con cifra di controllo corretta", () => {
		assert.equal(isValidVatNumber("01234567897"), true);
		assert.equal(isValidVatNumber("00000010009"), true); // prime 7 cifre non tutte zero
	});

	it("rifiuta cifra di controllo sbagliata, lunghezza e formato errati", () => {
		assert.equal(isValidVatNumber("01234567890"), false);
		assert.equal(isValidVatNumber("1234567897"), false);
		assert.equal(isValidVatNumber("IT01234567897"), false);
		assert.equal(isValidVatNumber("0123456789a"), false);
		assert.equal(isValidVatNumber(undefined), false);
	});

	it("rifiuta le prime 7 cifre tutte zero anche se Luhn torna", () => {
		assert.equal(isValidVatNumber("00000000000"), false);
	});
});
