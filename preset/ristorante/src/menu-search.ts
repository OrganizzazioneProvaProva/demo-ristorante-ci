import type { Language } from "@siti/config";
import { searchIndexText } from "@siti/core/content/search.ts";
import type { ResolvedItem } from "./menu.ts";
import { MENU_LABELS } from "./menu-labels.ts";

/**
 * Testo di ricerca di un piatto (contratto di `core/src/content/search.ts`): nome, descrizione,
 * componenti (gli ingredienti), dieta e allergeni, tutti campi modificabili dallo Studio.
 *
 * Gli allergeni entrano solo se "verificati" (stato `listed`): se non lo sono, il sito non dichiara
 * nulla e la ricerca non deve farlo. Una ricerca per allergene trova i piatti che lo CONTENGONO:
 * un piatto che non compare non è, per questo, privo di quell'allergene.
 */
export function itemSearchText(item: ResolvedItem, language: Language): string {
	const labels = MENU_LABELS[language];
	return searchIndexText([
		item.name,
		item.description,
		...item.components,
		item.diet === "vegetarian" ? labels.vegetarian : undefined,
		item.diet === "vegan" ? labels.vegan : undefined,
		...(item.allergens.status === "listed"
			? item.allergens.allergens.map((allergen) => allergen.label)
			: []),
	]);
}
