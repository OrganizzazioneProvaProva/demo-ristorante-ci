import type { Language } from "@siti/config";
import type { NavigationEntry } from "@siti/core/content/shell.ts";

/**
 * Testi fissi della sezione del menu, in tutte le lingue del core (IT+EN): una lingua senza una
 * voce non compila. I testi sugli allergeni sono segnaposto da far validare (11, regole di settore).
 */
export interface MenuLabels {
	menu: string;
	groups: string;
	sections: string;
	allergens: string;
	noAllergens: string;
	featured: string;
	vegetarian: string;
	vegan: string;
	components: string;
	search: string;
}

export const MENU_LABELS: Record<Language, MenuLabels> = {
	it: {
		menu: "Menu",
		groups: "Menu disponibili",
		sections: "Sezioni",
		allergens: "Allergeni",
		noAllergens: "nessuno dichiarato",
		featured: "In evidenza",
		vegetarian: "Vegetariano",
		vegan: "Vegano",
		components: "Componenti",
		search: "Cerca nel menu",
	},
	en: {
		menu: "Menu",
		groups: "Available menus",
		sections: "Sections",
		allergens: "Allergens",
		noAllergens: "none declared",
		featured: "Featured",
		vegetarian: "Vegetarian",
		vegan: "Vegan",
		components: "Components",
		search: "Search the menu",
	},
};

export const MENU_NAV_ENTRY = {
	slug: "menu",
	label: { it: MENU_LABELS.it.menu, en: MENU_LABELS.en.menu },
} satisfies NavigationEntry;

/**
 * Azione "Menu" della barra di azioni: va subito dopo la prima azione (il pulsante pieno,
 * Prenota o Chiama) e prima delle altre. `href` è il percorso della pagina del menu.
 */
export function withMenuAction<T extends { label: string; href: string }>(
	actions: readonly T[],
	language: Language,
	href: string,
): Array<T | { label: string; href: string }> {
	const [first, ...rest] = actions;
	const menu = { label: MENU_LABELS[language].menu, href };
	return first ? [first, menu, ...rest] : [menu];
}
