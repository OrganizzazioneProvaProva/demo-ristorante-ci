import { intervalSpan } from "@siti/config/rules";
import { addDays, nationalHolidays } from "./holidays.ts";
import type { OpeningHours, Weekday } from "./opening-hours.ts";

/**
 * "Aperto ora": logica PURA, senza zod né Sanity, così il piccolo script del browser
 * (`scripts/open-status.ts`) la porta senza il peso dello schema. Vive qui e `opening-hours.ts`
 * la riesporta (stessa API pubblica di prima).
 */
export const DEFAULT_TIME_ZONE = "Europe/Rome";

export interface StatusOptions {
	timeZone?: string;
}

export type ClosedReason = "closure" | "patron-saint" | "holiday";

export interface OpenStatus {
	open: boolean;
	/** `open` se aperto; `regular` se è un giorno o un'ora di chiusura normale. */
	reason: "open" | "regular" | ClosedReason;
	/** Se aperto: ora di chiusura della fascia in corso ("HH:MM", ora locale). */
	closesAt?: string;
	/** Se chiuso: la prossima apertura (entro 8 giorni). */
	nextOpening?: { date: string; opens: string };
}

const WEEKDAY_BY_UTC_DAY: readonly Weekday[] = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
];

/** Data (AAAA-MM-GG) e minuti dalla mezzanotte nel fuso orario indicato. */
export function localDateTime(
	now: Date,
	timeZone: string = DEFAULT_TIME_ZONE,
): { date: string; minutes: number } {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(now);
	const get = (type: string) =>
		parts.find((part) => part.type === type)?.value ?? "0";
	return {
		date: `${get("year")}-${get("month")}-${get("day")}`,
		minutes: Number(get("hour")) * 60 + Number(get("minute")),
	};
}

/** Giorno della settimana di una data AAAA-MM-GG (calendario, senza fuso). */
export function weekdayOf(date: string): Weekday {
	const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
	return WEEKDAY_BY_UTC_DAY[
		new Date(Date.UTC(year, month - 1, day)).getUTCDay()
	] as Weekday;
}

function closedReason(
	date: string,
	hours: OpeningHours,
): ClosedReason | undefined {
	if (hours.closures?.some((c) => c.from <= date && date <= c.to)) {
		return "closure";
	}
	const patron = hours.patronSaintDay;
	if (
		patron &&
		Number(date.slice(5, 7)) === patron.month &&
		Number(date.slice(8, 10)) === patron.day
	) {
		return "patron-saint";
	}
	const closedIds = hours.closedHolidays ?? [];
	if (
		closedIds.length > 0 &&
		nationalHolidays(Number(date.slice(0, 4))).some(
			(h) => h.date === date && closedIds.includes(h.id),
		)
	) {
		return "holiday";
	}
	return undefined;
}

/** Fasce del giorno in minuti dalla mezzanotte; la chiusura dopo mezzanotte supera 1440. */
function slotsOn(date: string, hours: OpeningHours): Array<[number, number]> {
	if (closedReason(date, hours)) return [];
	const day = hours[weekdayOf(date)];
	if (day.closed) return [];
	return (day.intervals ?? [])
		.map((interval) => intervalSpan(interval))
		.filter((span): span is [number, number] => span !== undefined)
		.sort((a, b) => a[0] - b[0]);
}

const format = (minutes: number) =>
	`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * "Aperto ora" (02): fuso `Europe/Rome`, chiusure straordinarie, festa del patrono e,
 * se richiesto, festività nazionali. Funzione pura: il browser la chiama con `new Date()`.
 */
export function openingStatus(
	hours: OpeningHours,
	now: Date,
	options: StatusOptions = {},
): OpenStatus {
	const { date, minutes } = localDateTime(now, options.timeZone);
	const today = slotsOn(date, hours);

	// Una fascia di ieri che finisce dopo mezzanotte è ancora in corso.
	for (const [, end] of slotsOn(addDays(date, -1), hours)) {
		if (end > 1440 && minutes < end - 1440) {
			return { open: true, reason: "open", closesAt: format(end - 1440) };
		}
	}
	for (const [start, end] of today) {
		if (minutes >= start && minutes < end) {
			return { open: true, reason: "open", closesAt: format(end % 1440) };
		}
	}

	const reason = closedReason(date, hours) ?? "regular";
	for (let offset = 0; offset <= 7; offset++) {
		const day = addDays(date, offset);
		for (const [start] of slotsOn(day, hours)) {
			if (offset > 0 || start > minutes) {
				return {
					open: false,
					reason,
					nextOpening: { date: day, opens: format(start) },
				};
			}
		}
	}
	return { open: false, reason };
}
