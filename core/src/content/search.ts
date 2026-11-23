import type { Language } from "@siti/config";

/**
 * Ricerca nel catalogo, valida per ogni nicchia (i piatti di un menu, i servizi di uno studio
 * legale, i prodotti di un negozio). Il contratto è semplice: ogni elemento cercabile ha un
 * testo di ricerca, scritto alla build nell'HTML (`data-search`). Quel testo lo compone la
 * nicchia con i campi dell'elemento (nome, descrizione, sotto-elementi): tutti campi modificabili
 * dallo Studio. Il browser filtra gli elementi già presenti nella pagina (nessuna richiesta, nessun
 * indice a parte). Questo modulo non dipende dal browser: lo usano sia la build sia lo script.
 */

/** Minuscole, senza accenti né punteggiatura, spazi singoli: "Più Gusto!" diventa "piu gusto". */
export function normalizeSearchText(text: string): string {
	return text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

/** Testo di ricerca di un elemento: le parti presenti, normalizzate, separate da uno spazio. */
export function searchIndexText(
	parts: ReadonlyArray<string | null | undefined>,
): string {
	return normalizeSearchText(
		parts.filter((part): part is string => Boolean(part)).join(" "),
	);
}

/**
 * Vero se OGNI parola cercata compare nel testo dell'elemento (parole anche parziali:
 * "ricot" trova "ricotta"). Una ricerca vuota trova tutto.
 */
export function matchesAll(index: string, query: string): boolean {
	const words = normalizeSearchText(query).split(" ").filter(Boolean);
	return words.every((word) => index.includes(word));
}

export interface SearchLabels {
	/** `{n}` è il numero di risultati. */
	resultsMany: string;
	resultsOne: string;
	resultsNone: string;
}

export const SEARCH_LABELS: Record<Language, SearchLabels> = {
	it: {
		resultsMany: "{n} risultati",
		resultsOne: "1 risultato",
		resultsNone: "Nessun risultato",
	},
	en: {
		resultsMany: "{n} results",
		resultsOne: "1 result",
		resultsNone: "No results",
	},
};

/** Testo per l'area di stato (annunciata dagli screen reader). */
export function resultsText(count: number, labels: SearchLabels): string {
	if (count === 0) return labels.resultsNone;
	if (count === 1) return labels.resultsOne;
	return labels.resultsMany.replace("{n}", String(count));
}
