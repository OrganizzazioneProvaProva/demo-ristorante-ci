/**
 * Tipi di cucina che il titolare può dichiarare (campo `cuisine` del menu). Il valore è la
 * stringa inglese di schema.org `servesCuisine` (Google vuole valori in inglese); l'etichetta
 * italiana sta nello Studio (`studio/src/cuisines.ts`, un test li tiene allineati). Mai cambiare
 * un valore: finisce nei contenuti dei clienti. Si aggiunge in coda quando serve.
 */
export const CUISINES = [
	{ value: "Italian", it: "Italiana" },
	{ value: "Pizza", it: "Pizza" },
	{ value: "Sicilian", it: "Siciliana" },
	{ value: "Seafood", it: "Pesce" },
	{ value: "Steakhouse", it: "Carne e griglia" },
	{ value: "Vegetarian", it: "Vegetariana" },
	{ value: "Vegan", it: "Vegana" },
	{ value: "Mediterranean", it: "Mediterranea" },
	{ value: "Street food", it: "Cibo di strada" },
	{ value: "Japanese", it: "Giapponese" },
	{ value: "Chinese", it: "Cinese" },
	{ value: "Indian", it: "Indiana" },
	{ value: "Mexican", it: "Messicana" },
	{ value: "Bakery", it: "Panificio e pasticceria" },
	{ value: "Cafe", it: "Caffetteria" },
] as const;

export type CuisineValue = (typeof CUISINES)[number]["value"];

export const CUISINE_VALUES = CUISINES.map((c) => c.value) as [
	CuisineValue,
	...CuisineValue[],
];
