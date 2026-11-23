/**
 * Catalogo delle festività che il titolare può segnare come "chiuso" (Studio) e che il sito
 * conosce (core). Gli id sono quelli salvati nei dati: non cambiarli senza una migrazione.
 */
export const HOLIDAYS = [
	{ id: "new-year", name: "Capodanno" },
	{ id: "epiphany", name: "Epifania" },
	{ id: "easter", name: "Pasqua" },
	{ id: "easter-monday", name: "Lunedì dell'Angelo" },
	{ id: "liberation", name: "Festa della Liberazione" },
	{ id: "labour", name: "Festa dei lavoratori" },
	{ id: "republic", name: "Festa della Repubblica" },
	{ id: "assumption", name: "Ferragosto" },
	{ id: "st-francis", name: "San Francesco d'Assisi" },
	{ id: "all-saints", name: "Ognissanti" },
	{ id: "immaculate", name: "Immacolata Concezione" },
	{ id: "christmas", name: "Natale" },
	{ id: "st-stephen", name: "Santo Stefano" },
] as const;
export type HolidayId = (typeof HOLIDAYS)[number]["id"];
