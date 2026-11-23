import type { Language } from "@siti/config";

/**
 * I 14 allergeni dell'Allegato II del Reg. UE 1169/2011, nell'ordine della fonte, con i
 * nomi in italiano e in inglese (EUR-Lex, versioni IT ed EN verificate il 18/11/2026).
 * I codici sono gli stessi dello Studio (`@siti/preset-ristorante-studio`): un test lo
 * controlla. Mai cambiare un codice: finisce nei contenuti dei clienti.
 */
export const ALLERGENS = [
	{
		code: "gluten",
		it: "Cereali contenenti glutine",
		en: "Cereals containing gluten",
	},
	{ code: "crustaceans", it: "Crostacei", en: "Crustaceans" },
	{ code: "eggs", it: "Uova", en: "Eggs" },
	{ code: "fish", it: "Pesce", en: "Fish" },
	{ code: "peanuts", it: "Arachidi", en: "Peanuts" },
	{ code: "soy", it: "Soia", en: "Soybeans" },
	{ code: "milk", it: "Latte e lattosio", en: "Milk (including lactose)" },
	{ code: "tree-nuts", it: "Frutta a guscio", en: "Nuts" },
	{ code: "celery", it: "Sedano", en: "Celery" },
	{ code: "mustard", it: "Senape", en: "Mustard" },
	{ code: "sesame", it: "Semi di sesamo", en: "Sesame seeds" },
	{
		code: "sulphites",
		it: "Anidride solforosa e solfiti",
		en: "Sulphur dioxide and sulphites",
	},
	{ code: "lupin", it: "Lupini", en: "Lupin" },
	{ code: "molluscs", it: "Molluschi", en: "Molluscs" },
] as const;

export type AllergenCode = (typeof ALLERGENS)[number]["code"];

export const ALLERGEN_CODES = ALLERGENS.map((a) => a.code) as [
	AllergenCode,
	...AllergenCode[],
];

export function allergenLabel(code: AllergenCode, language: Language): string {
	const allergen = ALLERGENS.find((a) => a.code === code);
	if (!allergen) throw new Error(`Allergene sconosciuto: ${code}`);
	return allergen[language];
}

/**
 * Invito mostrato quando gli allergeni di un piatto non sono stati verificati. Il testo è un
 * segnaposto: va validato con l'avvocato (11, regole di settore; 06).
 */
export const ASK_STAFF_NOTICE: Record<Language, string> = {
	it: "Chiedi informazioni sugli allergeni al personale.",
	en: "Please ask our staff for allergen information.",
};
