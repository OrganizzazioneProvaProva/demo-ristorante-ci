import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	BOOKING_REQUEST_FIELDS,
	bookingRequestSchema,
} from "./booking-request.ts";

const valid = {
	name: "Mario Rossi",
	email: "mario@example.com",
	date: "2026-12-24",
	time: "20:30",
	people: "4",
	consent: "on",
};

describe("richiesta di prenotazione del ristorante", () => {
	it("ha i campi del core più data, ora e persone, senza doppioni", () => {
		const names = BOOKING_REQUEST_FIELDS.map((field) => field.name);
		assert.deepEqual(names, [
			"name",
			"email",
			"phone",
			"date",
			"time",
			"people",
			"message",
		]);
	});

	it("accetta una richiesta completa", () => {
		assert.ok(bookingRequestSchema.safeParse(valid).success);
	});

	it("valida il calendario senza orologio, anche per una data passata", () => {
		assert.ok(
			bookingRequestSchema.safeParse({ ...valid, date: "2024-02-29" }).success,
		);
		assert.ok(
			bookingRequestSchema.safeParse({ ...valid, date: "2000-01-01" }).success,
		);
		for (const date of ["2026-02-29", "2024-04-31"]) {
			assert.equal(
				bookingRequestSchema.safeParse({ ...valid, date }).success,
				false,
			);
		}
	});

	it("richiede data, ora e persone", () => {
		for (const key of ["date", "time", "people"] as const) {
			const { [key]: _removed, ...rest } = valid;
			assert.equal(bookingRequestSchema.safeParse(rest).success, false, key);
		}
	});

	it("rifiuta un'ora o un numero di persone fuori limite", () => {
		assert.equal(
			bookingRequestSchema.safeParse({ ...valid, time: "25:00" }).success,
			false,
		);
		assert.equal(
			bookingRequestSchema.safeParse({ ...valid, people: "100" }).success,
			false,
		);
	});
});
