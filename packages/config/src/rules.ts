/**
 * Funzioni di validazione pure, senza dipendenze da Sanity: così si provano con test
 * semplici e il Studio le usa dentro `validation: (rule) => rule.custom(...)`.
 */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Orario "HH:MM" a 24 ore. */
export function isValidTime(value: unknown): value is string {
	return typeof value === "string" && TIME.test(value);
}

export interface TimeInterval {
	opens?: string;
	closes?: string;
}

/**
 * Fascia sulla linea dei minuti del giorno. Se chiude prima (o alla stessa ora) di aprire,
 * la chiusura è il giorno dopo: 19:00-01:00 diventa [1140, 1500].
 */
export function intervalSpan(
	interval: TimeInterval,
): [number, number] | undefined {
	if (!isValidTime(interval.opens) || !isValidTime(interval.closes)) {
		return undefined;
	}
	const toMinutes = (time: string) => {
		const [hours = 0, minutes = 0] = time.split(":").map(Number);
		return hours * 60 + minutes;
	};
	const start = toMinutes(interval.opens);
	const end = toMinutes(interval.closes);
	return [start, end <= start ? end + 24 * 60 : end];
}

/** Messaggio d'errore se due fasce dello stesso giorno si sovrappongono, altrimenti `undefined`. */
export function findOverlap(
	intervals: readonly TimeInterval[],
): string | undefined {
	const spans = intervals
		.map(intervalSpan)
		.filter((span): span is [number, number] => span !== undefined);
	for (let i = 0; i < spans.length; i++) {
		for (let j = i + 1; j < spans.length; j++) {
			const [startA, endA] = spans[i] as [number, number];
			const [startB, endB] = spans[j] as [number, number];
			if (startA < endB && startB < endA) {
				return "Due fasce orarie si sovrappongono.";
			}
		}
	}
	return undefined;
}

/** Giorno e mese esistenti (il 29 febbraio è ammesso). */
export function isValidMonthDay(month: unknown, day: unknown): boolean {
	if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
	const m = month as number;
	const d = day as number;
	if (m < 1 || m > 12 || d < 1) return false;
	// Anno bisestile come riferimento: new Date(2024, m, 0) è l'ultimo giorno del mese m.
	return d <= new Date(2024, m, 0).getDate();
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Messaggio d'errore se la fine precede l'inizio (date "AAAA-MM-GG"), altrimenti `undefined`. */
export function dateRangeError(
	from: string | undefined,
	to: string | undefined,
): string | undefined {
	if (!from || !to || !DATE.test(from) || !DATE.test(to)) return undefined;
	return to < from ? "La data finale è prima di quella iniziale." : undefined;
}

/** Segmento di percorso di Sanity: nome di campo, indice, oppure elemento di un array per `_key`. */
export type PathSegment = string | number | { _key: string };

/**
 * Legge un valore da un documento seguendo un percorso di Sanity (come `context.path`),
 * anche attraverso gli array con elementi identificati da `_key`.
 */
export function valueAtPath(
	root: unknown,
	path: readonly PathSegment[],
): unknown {
	let current: unknown = root;
	for (const segment of path) {
		if (current === null || current === undefined) return undefined;
		if (typeof segment === "object") {
			if (!Array.isArray(current)) return undefined;
			current = current.find(
				(item) =>
					(item as { _key?: string } | undefined)?._key === segment._key,
			);
		} else {
			current = (current as Record<string | number, unknown>)[segment];
		}
	}
	return current;
}

/**
 * Partita IVA italiana: 11 cifre, prime 7 non tutte zero, cifra di controllo di Luhn.
 * Non controlla il codice dell'ufficio (cifre 8-10): l'elenco degli uffici cambia e un
 * falso rifiuto blocca un cliente vero. Algoritmo come python-stdnum (`it/iva.py`).
 */
export function isValidVatNumber(value: unknown): value is string {
	if (typeof value !== "string" || !/^\d{11}$/.test(value)) return false;
	if (Number(value.slice(0, 7)) === 0) return false;
	let sum = 0;
	for (let i = 0; i < 11; i++) {
		let digit = Number(value[10 - i]);
		if (i % 2 === 1) {
			digit *= 2;
			if (digit > 9) digit -= 9;
		}
		sum += digit;
	}
	return sum % 10 === 0;
}
