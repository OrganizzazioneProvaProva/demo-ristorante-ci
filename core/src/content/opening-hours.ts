import {
	dateRangeError,
	findOverlap,
	HOLIDAYS,
	isValidMonthDay,
	isValidTime,
} from "@siti/config";
import { z } from "zod";
import { localizedTextSchema } from "./localized.ts";

export const WEEKDAYS = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const HOLIDAY_IDS = HOLIDAYS.map((h) => h.id) as [
	(typeof HOLIDAYS)[number]["id"],
	...(typeof HOLIDAYS)[number]["id"][],
];

const timeSchema = z.string().refine(isValidTime, "serve un orario HH:MM");

const intervalSchema = z
	.object({ opens: timeSchema, closes: timeSchema })
	.refine((i) => i.opens !== i.closes, "apertura e chiusura coincidono");

const daySchema = z
	.object({
		closed: z.boolean().nullish(),
		intervals: z.array(intervalSchema).nullish(),
	})
	.superRefine((day, ctx) => {
		if (day.closed) return;
		const intervals = day.intervals ?? [];
		if (intervals.length === 0) {
			ctx.addIssue({
				code: "custom",
				message: "giorno aperto senza fasce orarie",
			});
			return;
		}
		const overlap = findOverlap(intervals);
		if (overlap) ctx.addIssue({ code: "custom", message: overlap });
	});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "serve AAAA-MM-GG");

const closureSchema = z
	.object({
		from: dateSchema,
		to: dateSchema,
		reason: localizedTextSchema.nullish(),
	})
	.refine(
		(c) => dateRangeError(c.from, c.to) === undefined,
		"la data finale è prima di quella iniziale",
	);

/** Orari di apertura come arrivano da Sanity (documento `openingHours`). */
export const openingHoursSchema = z.object({
	monday: daySchema,
	tuesday: daySchema,
	wednesday: daySchema,
	thursday: daySchema,
	friday: daySchema,
	saturday: daySchema,
	sunday: daySchema,
	closures: z.array(closureSchema).nullish(),
	/**
	 * Festività in cui il locale è chiuso, scelte dal titolare una per una. Vuoto o assente:
	 * le festività non cambiano nulla (valgono gli orari della settimana).
	 */
	closedHolidays: z.array(z.enum(HOLIDAY_IDS)).nullish(),
	/** Compilata = il locale è chiuso quel giorno (chi lavora nel giorno del patrono la lascia vuota). */
	patronSaintDay: z
		.object({ day: z.number().int(), month: z.number().int() })
		.nullish()
		.refine(
			(p) => !p || isValidMonthDay(p.month, p.day),
			"giorno e mese della festa del patrono non esistono",
		),
});
export type OpeningHours = z.output<typeof openingHoursSchema>;

export {
	type ClosedReason,
	DEFAULT_TIME_ZONE,
	localDateTime,
	type OpenStatus,
	openingStatus,
	type StatusOptions,
} from "./opening-status.ts";
