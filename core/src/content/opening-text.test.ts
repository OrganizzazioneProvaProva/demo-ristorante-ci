import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type OpeningHours, openingHoursSchema } from "./opening-hours.ts";
import { HOURS_LABELS } from "./opening-labels.ts";
import { localDateTime, openingStatus } from "./opening-status.ts";
import { describeStatus } from "./opening-text.ts";

const day = (intervals: Array<[string, string]>) => ({
	intervals: intervals.map(([opens, closes]) => ({ opens, closes })),
});
// Lunedì chiuso; martedì-domenica 12:00-15:00 e 19:00-23:00. Chiusura il 2026-12-24.
const hours: OpeningHours = openingHoursSchema.parse({
	monday: { closed: true },
	tuesday: day([
		["12:00", "15:00"],
		["19:00", "23:00"],
	]),
	wednesday: day([
		["12:00", "15:00"],
		["19:00", "23:00"],
	]),
	thursday: day([
		["12:00", "15:00"],
		["19:00", "23:00"],
	]),
	friday: day([
		["12:00", "15:00"],
		["19:00", "23:00"],
	]),
	saturday: day([
		["12:00", "15:00"],
		["19:00", "23:00"],
	]),
	sunday: day([
		["12:00", "15:00"],
		["19:00", "23:00"],
	]),
	closures: [{ from: "2026-12-24", to: "2026-12-24" }],
});

// 2026-12-01 è un martedì. In dicembre l'ora di Roma è UTC+1.
const at = (iso: string) => new Date(iso);
const text = (iso: string, language: "it" | "en" = "it") => {
	const now = at(iso);
	return describeStatus(
		openingStatus(hours, now),
		localDateTime(now).date,
		HOURS_LABELS[language],
	);
};

describe("describeStatus", () => {
	it("aperto: dice a che ora chiude la fascia in corso", () => {
		assert.equal(
			text("2026-12-01T12:00:00Z"),
			"Aperto ora · chiude alle 15:00",
		);
		assert.equal(
			text("2026-12-01T12:00:00Z", "en"),
			"Open now · closes at 15:00",
		);
	});

	it("tra pranzo e cena: chiuso, riapre oggi alle 19:00", () => {
		assert.equal(
			text("2026-12-01T15:30:00Z"),
			"Chiuso ora · riapre alle 19:00",
		);
	});

	it("dopo la chiusura serale: riapre domani", () => {
		assert.equal(
			text("2026-12-01T22:30:00Z"),
			"Chiuso ora · riapre domani alle 12:00",
		);
	});

	it("il lunedì (giorno di chiusura) dice quando riapre il martedì", () => {
		assert.equal(
			text("2026-11-30T11:00:00Z"),
			"Chiuso ora · riapre domani alle 12:00",
		);
	});

	it("una chiusura straordinaria è «chiuso oggi» con la prossima apertura, nella lingua", () => {
		assert.equal(
			text("2026-12-24T11:00:00Z"),
			"Chiuso oggi · riapre domani alle 12:00",
		);
		assert.equal(
			text("2026-12-24T11:00:00Z", "en"),
			"Closed today · reopens tomorrow at 12:00",
		);
	});

	it("una riapertura oltre domani nomina il giorno nella lingua", () => {
		const closedWeek: OpeningHours = openingHoursSchema.parse({
			...hours,
			closures: [{ from: "2026-12-01", to: "2026-12-03" }],
		});
		const now = at("2026-12-01T11:00:00Z");
		const status = openingStatus(closedWeek, now);
		assert.equal(
			describeStatus(status, localDateTime(now).date, HOURS_LABELS.it),
			"Chiuso oggi · riapre venerdì alle 12:00",
		);
		assert.equal(
			describeStatus(status, localDateTime(now).date, HOURS_LABELS.en),
			"Closed today · reopens Friday at 12:00",
		);
	});

	it("il fuso è Europe/Rome: le 23:30 UTC di inverno sono già mezzanotte e mezza del giorno dopo", () => {
		// 2026-12-01T23:30Z = 2026-12-02 00:30 a Roma (mercoledì): chiuso, riapre alle 12:00 oggi
		assert.equal(
			text("2026-12-01T23:30:00Z"),
			"Chiuso ora · riapre alle 12:00",
		);
	});
});

describe("HOURS_LABELS", () => {
	it("ogni lingua ha tutte le voci, i segnaposto giusti e i sette giorni", () => {
		for (const labels of Object.values(HOURS_LABELS)) {
			assert.match(labels.openUntil, /\{time\}/);
			assert.match(labels.reopensToday, /\{time\}/);
			assert.match(labels.reopensTomorrow, /\{time\}/);
			assert.match(labels.reopensOn, /\{day\}.*\{time\}|\{time\}.*\{day\}/);
			assert.equal(Object.keys(labels.weekdays).length, 7);
			assert.equal(Object.keys(labels.weekdaysInSentence).length, 7);
		}
		assert.notEqual(HOURS_LABELS.en.closedNow, HOURS_LABELS.it.closedNow);
	});
});
