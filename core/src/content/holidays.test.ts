import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HOLIDAYS } from "@siti/config";
import { addDays, easterSunday, nationalHolidays } from "./holidays.ts";

describe("Pasqua e festività", () => {
	it("calcola la domenica di Pasqua", () => {
		assert.deepEqual(easterSunday(2025), { month: 4, day: 20 });
		assert.deepEqual(easterSunday(2026), { month: 4, day: 5 });
		assert.deepEqual(easterSunday(2027), { month: 3, day: 28 });
	});

	it("elenca le festività nazionali in ordine, con Pasqua e Pasquetta", () => {
		const holidays = nationalHolidays(2026);
		assert.equal(holidays.length, 13);
		assert.ok(
			holidays.some((h) => h.date === "2026-04-05" && h.name === "Pasqua"),
		);
		assert.deepEqual(
			holidays.map((h) => h.date),
			[...holidays.map((h) => h.date)].sort(),
		);
		assert.ok(
			holidays.some((h) => h.date === "2026-04-06" && /Angelo/.test(h.name)),
		);
		assert.ok(holidays.some((h) => h.date === "2026-12-25"));
		assert.ok(holidays.some((h) => h.date === "2026-08-15"));
	});

	it("addDays passa correttamente da un mese e da un anno all'altro", () => {
		assert.equal(addDays("2026-12-31", 1), "2027-01-01");
		assert.equal(addDays("2026-03-01", -1), "2026-02-28");
		assert.equal(addDays("2028-02-28", 1), "2028-02-29");
	});

	it("ogni festività ha un id stabile e unico, uguale a quello del catalogo", () => {
		const ids = nationalHolidays(2026).map((h) => h.id);
		assert.deepEqual([...ids].sort(), HOLIDAYS.map((h) => h.id).sort());
		assert.equal(new Set(ids).size, ids.length);
	});

	it("il 4 ottobre è festa nazionale dal 2026 (L. 151/2025), non prima", () => {
		assert.ok(nationalHolidays(2026).some((h) => h.date === "2026-10-04"));
		assert.ok(nationalHolidays(2027).some((h) => h.date === "2027-10-04"));
		assert.ok(!nationalHolidays(2025).some((h) => h.date === "2025-10-04"));
		assert.equal(nationalHolidays(2025).length, 12);
	});
});
