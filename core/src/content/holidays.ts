import { HOLIDAYS, type HolidayId } from "@siti/config/holidays";

/** Giorno di Pasqua (calendario gregoriano) con l'algoritmo di Meeus/Jones/Butcher. */
export function easterSunday(year: number): { month: number; day: number } {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return { month, day };
}

const pad = (value: number) => String(value).padStart(2, "0");

export function addDays(date: string, days: number): string {
	const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
	const moved = new Date(Date.UTC(year, month - 1, day + days));
	return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
}

/**
 * Festività dell'anno, come INFORMAZIONE: il sito non decide mai che un locale è chiuso per
 * una festa. Lo decide il titolare, festa per festa (`closedHolidays` negli orari).
 * Il 4 ottobre è festa nazionale dal 1/1/2026 (L. 8/10/2025 n. 151, Normattiva
 * eli/id/2025/10/10/25G00153). Pasqua e i giorni elencati qui sono un catalogo di scelta
 * del prodotto, non l'elenco dell'art. 2 L. 260/1949 (che cita "tutte le domeniche" e il
 * "lunedì dopo Pasqua"). Le altre domeniche non sono elencate: si gestiscono con gli orari.
 */
export function nationalHolidays(
	year: number,
): Array<{ id: HolidayId; date: string; name: string }> {
	const fixed: Array<[number, number, HolidayId]> = [
		[1, 1, "new-year"],
		[1, 6, "epiphany"],
		[4, 25, "liberation"],
		[5, 1, "labour"],
		[6, 2, "republic"],
		[8, 15, "assumption"],
		[11, 1, "all-saints"],
		[12, 8, "immaculate"],
		[12, 25, "christmas"],
		[12, 26, "st-stephen"],
	];
	if (year >= 2026) fixed.push([10, 4, "st-francis"]);
	const easter = easterSunday(year);
	const easterDate = `${year}-${pad(easter.month)}-${pad(easter.day)}`;
	const dated: Array<{ id: HolidayId; date: string }> = [
		...fixed.map(([month, day, id]) => ({
			id,
			date: `${year}-${pad(month)}-${pad(day)}`,
		})),
		{ id: "easter", date: easterDate },
		{ id: "easter-monday", date: addDays(easterDate, 1) },
	];
	return dated
		.map(({ id, date }) => ({
			id,
			date,
			name: HOLIDAYS.find((h) => h.id === id)?.name ?? id,
		}))
		.sort((x, y) => x.date.localeCompare(y.date));
}
