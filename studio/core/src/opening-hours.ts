import {
	dateRangeError,
	findOverlap,
	HOLIDAYS,
	isValidMonthDay,
	isValidTime,
	type TimeInterval,
} from "@siti/config";
import { defineField, defineType } from "sanity";

export const WEEKDAYS = [
	{ name: "monday", title: "Lunedì" },
	{ name: "tuesday", title: "Martedì" },
	{ name: "wednesday", title: "Mercoledì" },
	{ name: "thursday", title: "Giovedì" },
	{ name: "friday", title: "Venerdì" },
	{ name: "saturday", title: "Sabato" },
	{ name: "sunday", title: "Domenica" },
] as const;

const timeField = (name: "opens" | "closes", title: string) =>
	defineField({
		name,
		title,
		type: "string",
		description: "Formato 24 ore, per esempio 19:30.",
		validation: (rule) =>
			rule
				.required()
				.custom((value) =>
					isValidTime(value)
						? true
						: "Usa il formato HH:MM, per esempio 19:30.",
				),
	});

/** Una fascia di apertura. Se chiude prima di aprire, la chiusura è il giorno dopo. */
export const timeIntervalType = defineType({
	name: "timeInterval",
	title: "Fascia oraria",
	type: "object",
	fields: [timeField("opens", "Apre"), timeField("closes", "Chiude")],
	preview: {
		select: { opens: "opens", closes: "closes" },
		prepare: ({ opens, closes }) => ({
			title: `${opens ?? "?"} – ${closes ?? "?"}`,
		}),
	},
});

/** Un giorno: chiuso, oppure una o più fasce (per esempio pranzo e cena). */
export const openingDayType = defineType({
	name: "openingDay",
	title: "Giorno",
	type: "object",
	fields: [
		defineField({
			name: "closed",
			title: "Chiuso tutto il giorno",
			type: "boolean",
			initialValue: false,
		}),
		defineField({
			name: "intervals",
			title: "Fasce di apertura",
			type: "array",
			of: [{ type: "timeInterval" }],
			hidden: ({ parent }) => parent?.closed === true,
			validation: (rule) =>
				rule.custom((value, context) => {
					if ((context.parent as { closed?: boolean } | undefined)?.closed) {
						return true;
					}
					const intervals = (value ?? []) as TimeInterval[];
					if (intervals.length === 0) {
						return "Aggiungi almeno una fascia oraria, oppure segna il giorno come chiuso.";
					}
					return findOverlap(intervals) ?? true;
				}),
		}),
	],
	preview: {
		select: { closed: "closed", intervals: "intervals" },
		prepare: ({ closed, intervals }) => ({
			title: closed
				? "Chiuso"
				: ((intervals ?? []) as TimeInterval[])
						.map((i) => `${i.opens ?? "?"}–${i.closes ?? "?"}`)
						.join(", ") || "Da compilare",
		}),
	},
});

/** Chiusura straordinaria (ferie, lavori, evento privato). */
export const closurePeriodType = defineType({
	name: "closurePeriod",
	title: "Chiusura straordinaria",
	type: "object",
	fields: [
		defineField({
			name: "from",
			title: "Dal",
			type: "date",
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: "to",
			title: "Al (compreso)",
			type: "date",
			validation: (rule) =>
				rule.required().custom((value, context) => {
					const from = (context.parent as { from?: string } | undefined)?.from;
					return dateRangeError(from, value as string | undefined) ?? true;
				}),
		}),
		defineField({
			name: "reason",
			title: "Motivo (facoltativo)",
			type: "localeString",
		}),
	],
	preview: {
		select: { from: "from", to: "to", reason: "reason.it" },
		prepare: ({ from, to, reason }) => ({
			title: `${from ?? "?"} → ${to ?? "?"}`,
			subtitle: reason,
		}),
	},
});

/** Festività selezionabili: il catalogo è in `@siti/config`, lo stesso che usa il sito. */
const HOLIDAY_OPTIONS = HOLIDAYS.map((h) => ({ value: h.id, title: h.name }));

/**
 * Orari di apertura: un solo documento per sito. Le date delle festività nazionali le
 * calcola il codice ma non decidono nulla: il titolare segna una per una quelle in cui è
 * chiuso. Qui si indicano anche chiusure straordinarie e la festa del patrono (02, "Aperto ora").
 */
export const openingHoursType = defineType({
	name: "openingHours",
	title: "Orari di apertura",
	type: "document",
	fields: [
		...WEEKDAYS.map(({ name, title }) =>
			defineField({
				name,
				title,
				type: "openingDay",
				validation: (rule) => rule.required(),
			}),
		),
		defineField({
			name: "closures",
			title: "Chiusure straordinarie",
			type: "array",
			of: [{ type: "closurePeriod" }],
		}),
		defineField({
			name: "closedHolidays",
			title: "Festività in cui sei chiuso",
			type: "array",
			of: [{ type: "string" }],
			options: { list: [...HOLIDAY_OPTIONS], layout: "grid" },
			description:
				"Segna solo le festività in cui il locale è chiuso. Quelle che non segni non cambiano nulla: valgono gli orari della settimana.",
		}),
		defineField({
			name: "patronSaintDay",
			title: "Festa del patrono del comune",
			type: "object",
			description:
				"Se nel tuo comune è festa e il locale è chiuso quel giorno, indica giorno e mese. Se lavori anche quel giorno, lascia vuoto.",
			fields: [
				// Il controllo sta sul campo "day" (un campo semplice): il validatore di Sanity
				// emette come avviso i controlli a livello di campo-oggetto, che non bloccherebbero.
				defineField({
					name: "day",
					title: "Giorno",
					type: "number",
					validation: (rule) =>
						rule.custom((value, context) => {
							const patron = context.parent as
								| { day?: number; month?: number }
								| undefined;
							if (value === undefined && patron?.month === undefined) {
								return true;
							}
							return isValidMonthDay(patron?.month, value)
								? true
								: "Indica un giorno e un mese che esistono.";
						}),
				}),
				defineField({ name: "month", title: "Mese (1-12)", type: "number" }),
			],
		}),
	],
	preview: { prepare: () => ({ title: "Orari di apertura" }) },
});
