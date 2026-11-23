/**
 * Tipi di cucina nello Studio: il valore è la stringa inglese di schema.org `servesCuisine`
 * (stesso elenco di `src/cuisines.ts`, un test li tiene allineati), il titolo è in italiano.
 */
export const CUISINES = [
	{ value: "Italian", title: "Italiana" },
	{ value: "Pizza", title: "Pizza" },
	{ value: "Sicilian", title: "Siciliana" },
	{ value: "Seafood", title: "Pesce" },
	{ value: "Steakhouse", title: "Carne e griglia" },
	{ value: "Vegetarian", title: "Vegetariana" },
	{ value: "Vegan", title: "Vegana" },
	{ value: "Mediterranean", title: "Mediterranea" },
	{ value: "Street food", title: "Cibo di strada" },
	{ value: "Japanese", title: "Giapponese" },
	{ value: "Chinese", title: "Cinese" },
	{ value: "Indian", title: "Indiana" },
	{ value: "Mexican", title: "Messicana" },
	{ value: "Bakery", title: "Panificio e pasticceria" },
	{ value: "Cafe", title: "Caffetteria" },
] as const;
