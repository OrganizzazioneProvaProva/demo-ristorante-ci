import type { Language } from "@siti/config";
import type { Weekday } from "./opening-hours.ts";

/** Testi fissi della sezione orari, in tutte le lingue del core (IT+EN): nessun ripiego. */
export interface HoursLabels {
	title: string;
	closedDay: string;
	closures: string;
	/** Stato: i segnaposto `{time}` e `{day}` li riempie `describeStatus`. */
	openUntil: string;
	closedNow: string;
	closedToday: string;
	reopensToday: string;
	reopensTomorrow: string;
	reopensOn: string;
	weekdays: Record<Weekday, string>;
	/** Il giorno dentro una frase: minuscolo in italiano («riapre venerdì»), maiuscolo in inglese. */
	weekdaysInSentence: Record<Weekday, string>;
}

export const HOURS_LABELS: Record<Language, HoursLabels> = {
	it: {
		title: "Orari di apertura",
		closedDay: "Chiuso",
		closures: "Chiusure straordinarie",
		openUntil: "Aperto ora · chiude alle {time}",
		closedNow: "Chiuso ora",
		closedToday: "Chiuso oggi",
		reopensToday: "riapre alle {time}",
		reopensTomorrow: "riapre domani alle {time}",
		reopensOn: "riapre {day} alle {time}",
		weekdays: {
			monday: "Lunedì",
			tuesday: "Martedì",
			wednesday: "Mercoledì",
			thursday: "Giovedì",
			friday: "Venerdì",
			saturday: "Sabato",
			sunday: "Domenica",
		},
		weekdaysInSentence: {
			monday: "lunedì",
			tuesday: "martedì",
			wednesday: "mercoledì",
			thursday: "giovedì",
			friday: "venerdì",
			saturday: "sabato",
			sunday: "domenica",
		},
	},
	en: {
		title: "Opening hours",
		closedDay: "Closed",
		closures: "Special closures",
		openUntil: "Open now · closes at {time}",
		closedNow: "Closed now",
		closedToday: "Closed today",
		reopensToday: "reopens at {time}",
		reopensTomorrow: "reopens tomorrow at {time}",
		reopensOn: "reopens {day} at {time}",
		weekdays: {
			monday: "Monday",
			tuesday: "Tuesday",
			wednesday: "Wednesday",
			thursday: "Thursday",
			friday: "Friday",
			saturday: "Saturday",
			sunday: "Sunday",
		},
		weekdaysInSentence: {
			monday: "Monday",
			tuesday: "Tuesday",
			wednesday: "Wednesday",
			thursday: "Thursday",
			friday: "Friday",
			saturday: "Saturday",
			sunday: "Sunday",
		},
	},
};
