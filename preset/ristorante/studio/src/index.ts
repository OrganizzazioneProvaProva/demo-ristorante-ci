import { definePlugin } from "sanity";
import { itemType, menuGroupType, menuSectionType, menuType } from "./menu.ts";

export { ALLERGENS, type AllergenCode } from "./allergens.ts";

/** Documenti che esistono in una sola copia per sito (si usano in `singletonDocumentConfig`). */
export const RISTORANTE_SINGLETON_TYPES = ["menu"] as const;

/**
 * Plugin Studio del preset ristorante/pizzeria (livello 2 di 02, "Schemi del CMS").
 * Presuppone `sitiStudioCore` nello stesso Studio: usa i suoi tipi `localeText`,
 * `localeString` e `siteImage`.
 */
export const sitiStudioRistorante = definePlugin(() => ({
	name: "siti-studio-ristorante",
	schema: { types: [itemType, menuSectionType, menuGroupType, menuType] },
}));
