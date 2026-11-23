/**
 * I 14 allergeni dell'Allegato II del Reg. UE 1169/2011 ("Sostanze o prodotti che provocano
 * allergie o intolleranze"), nell'ordine e con i nomi italiani della fonte (EUR-Lex,
 * verificata il 18/11/2026). Il valore è un codice stabile: non si cambia mai, perché
 * finisce nei contenuti dei clienti. Le etichette inglesi stanno nel codice del sito
 * (da verificare), non nello Studio.
 *
 * Obblighi e testo dell'avviso ("chiedi al personale"): da validare con l'avvocato (11, 06).
 */
export const ALLERGENS = [
	{ value: "gluten", title: "Cereali contenenti glutine" },
	{ value: "crustaceans", title: "Crostacei" },
	{ value: "eggs", title: "Uova" },
	{ value: "fish", title: "Pesce" },
	{ value: "peanuts", title: "Arachidi" },
	{ value: "soy", title: "Soia" },
	{ value: "milk", title: "Latte e lattosio" },
	{ value: "tree-nuts", title: "Frutta a guscio" },
	{ value: "celery", title: "Sedano" },
	{ value: "mustard", title: "Senape" },
	{ value: "sesame", title: "Semi di sesamo" },
	{ value: "sulphites", title: "Anidride solforosa e solfiti" },
	{ value: "lupin", title: "Lupini" },
	{ value: "molluscs", title: "Molluschi" },
] as const;

export type AllergenCode = (typeof ALLERGENS)[number]["value"];
