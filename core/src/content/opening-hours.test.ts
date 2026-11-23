import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	localDateTime,
	openingHoursSchema,
	openingStatus,
} from "./opening-hours.ts";

const lunchDinner = {
	closed: false,
	intervals: [
		{ opens: "12:00", closes: "15:00" },
		{ opens: "19:00", closes: "23:30" },
	],
};
const lateNight = {
	closed: false,
	intervals: [
		{ opens: "12:00", closes: "15:00" },
		{ opens: "19:00", closes: "00:30" },
	],
};
const base = {
	monday: { closed: true },
	tuesday: lunchDinner,
	wednesday: lunchDinner,
	thursday: lunchDinner,
	friday: lateNight,
	saturday: { closed: false, intervals: [{ opens: "19:00", closes: "00:30" }] },
	sunday: lunchDinner,
};
const hours = openingHoursSchema.parse({
	...base,
	closures: [{ from: "2026-08-10", to: "2026-08-13", reason: { it: "Ferie" } }],
	patronSaintDay: { day: 8, month: 9 },
});

const at = (iso: string, options = {}) =>
	openingStatus(hours, new Date(iso), options);

describe("fuso orario", () => {
	it("converte in ora di Roma, con l'ora legale e quella solare", () => {
		assert.deepEqual(localDateTime(new Date("2026-07-14T10:30:00Z")), {
			date: "2026-07-14",
			minutes: 12 * 60 + 30,
		});
		assert.deepEqual(localDateTime(new Date("2026-12-15T11:30:00Z")), {
			date: "2026-12-15",
			minutes: 12 * 60 + 30,
		});
		// mezzanotte e dieci a Roma = ancora il giorno prima in UTC
		assert.deepEqual(localDateTime(new Date("2026-07-18T22:10:00Z")), {
			date: "2026-07-19",
			minutes: 10,
		});
	});
});

describe("aperto ora", () => {
	it("a pranzo, d'estate e d'inverno, è aperto e dice quando chiude", () => {
		assert.deepEqual(at("2026-07-14T10:30:00Z"), {
			open: true,
			reason: "open",
			closesAt: "15:00",
		});
		assert.deepEqual(at("2026-12-15T11:30:00Z"), {
			open: true,
			reason: "open",
			closesAt: "15:00",
		});
	});

	it("tra pranzo e cena è chiuso e dice quando riapre", () => {
		assert.deepEqual(at("2026-07-14T14:00:00Z"), {
			open: false,
			reason: "regular",
			nextOpening: { date: "2026-07-14", opens: "19:00" },
		});
	});

	it("il giorno di chiusura settimanale riapre il giorno dopo", () => {
		assert.deepEqual(at("2026-07-13T11:00:00Z"), {
			open: false,
			reason: "regular",
			nextOpening: { date: "2026-07-14", opens: "12:00" },
		});
	});

	it("dopo mezzanotte resta aperto fino alla chiusura della sera prima", () => {
		assert.deepEqual(at("2026-07-18T22:10:00Z"), {
			open: true,
			reason: "open",
			closesAt: "00:30",
		});
		assert.equal(at("2026-07-18T22:40:00Z").open, false);
	});

	it("una chiusura straordinaria vale e indica la prossima apertura", () => {
		assert.deepEqual(at("2026-08-11T18:00:00Z"), {
			open: false,
			reason: "closure",
			nextOpening: { date: "2026-08-14", opens: "12:00" },
		});
	});

	it("la festa del patrono è un giorno di chiusura", () => {
		assert.equal(at("2026-09-08T18:00:00Z").reason, "patron-saint");
		assert.equal(at("2026-09-09T18:00:00Z").open, true);
	});

	it("le festività non chiudono nulla se il titolare non le segna", () => {
		// Ferragosto 2026 cade di sabato: aperto la sera
		assert.equal(at("2026-08-15T18:00:00Z").open, true);
	});

	it("nel giorno del cambio d'ora funziona (29 marzo 2026, domenica)", () => {
		assert.equal(at("2026-03-29T10:30:00Z").open, true); // 12:30 ora legale
	});
});

describe("schema degli orari", () => {
	it("rifiuta un giorno aperto senza fasce, fasce sovrapposte e orari sbagliati", () => {
		const bad = (day: object) =>
			openingHoursSchema.safeParse({ ...base, tuesday: day }).success;
		assert.equal(bad({ closed: false }), false);
		assert.equal(
			bad({
				closed: false,
				intervals: [
					{ opens: "12:00", closes: "15:00" },
					{ opens: "14:00", closes: "16:00" },
				],
			}),
			false,
		);
		assert.equal(
			bad({ closed: false, intervals: [{ opens: "25:00", closes: "15:00" }] }),
			false,
		);
		assert.equal(
			bad({ closed: false, intervals: [{ opens: "12:00", closes: "12:00" }] }),
			false,
		);
		assert.equal(bad({ closed: true }), true);
	});

	it("rifiuta una chiusura che finisce prima di iniziare e una festa del patrono inesistente", () => {
		assert.equal(
			openingHoursSchema.safeParse({
				...base,
				closures: [{ from: "2026-08-20", to: "2026-08-10" }],
			}).success,
			false,
		);
		assert.equal(
			openingHoursSchema.safeParse({
				...base,
				patronSaintDay: { day: 31, month: 4 },
			}).success,
			false,
		);
	});

	it("chiude solo nelle festività che il titolare ha segnato, una per una", () => {
		const hours = openingHoursSchema.parse({
			...base,
			closedHolidays: ["christmas", "st-francis"],
		});
		const closedChristmas = openingStatus(
			hours,
			new Date("2026-12-25T18:00:00Z"),
		);
		assert.equal(closedChristmas.open, false);
		assert.equal(closedChristmas.reason, "holiday");
		// 4 ottobre 2026 (domenica): segnato, chiuso
		assert.equal(
			openingStatus(hours, new Date("2026-10-04T18:00:00Z")).open,
			false,
		);
		// Pasqua 2026 (5 aprile) non è segnata: si apre come da orari
		assert.equal(
			openingStatus(hours, new Date("2026-04-05T18:00:00Z")).open,
			true,
		);
		// Ferragosto non segnato: aperto
		assert.equal(
			openingStatus(hours, new Date("2026-08-15T18:00:00Z")).open,
			true,
		);
	});

	it("il 4 ottobre 2025 non era festa: aperto anche se segnato", () => {
		const hours = openingHoursSchema.parse({
			...base,
			closedHolidays: ["st-francis"],
		});
		assert.equal(
			openingStatus(hours, new Date("2025-10-04T18:00:00Z")).open,
			true,
		);
	});

	it("rifiuta una festività sconosciuta", () => {
		assert.equal(
			openingHoursSchema.safeParse({ ...base, closedHolidays: ["carnevale"] })
				.success,
			false,
		);
	});
});
