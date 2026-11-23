import type { Language } from "@siti/config";
import {
	type NavigationEntry,
	resolveSiteShell,
} from "@siti/core/content/shell.ts";
import { MENU_NAV_ENTRY, withMenuAction } from "@siti/preset-ristorante/labels";
import { company, MAP_QUERY } from "./company.ts";
import { rawContacts } from "./contacts.ts";
import { config, pagePath } from "./home.ts";

/**
 * Logo del sito come file (`src/assets/logo.svg`, `.png`, `.webp`...): lo mettiamo all'onboarding e
 * può essere SVG. Se non c'è, e non c'è nemmeno un logo nello Studio, il piè di pagina mostra il nome.
 */
const localLogos = import.meta.glob<ImageMetadata>(
	"../assets/logo.{svg,png,webp,avif,jpg}",
	{ eager: true, import: "default" },
);
const localLogo = Object.values(localLogos)[0];

const navigation = [
	{ slug: "home", label: { it: "Home", en: "Home" } },
	MENU_NAV_ENTRY,
	{ slug: "galleria", label: { it: "Galleria", en: "Gallery" } },
	{ slug: "chi-siamo", label: { it: "Chi siamo", en: "About us" } },
	{ slug: "contatti", label: { it: "Contatti", en: "Contact" } },
] satisfies NavigationEntry[];

export function shellFor(language: Language, currentSlug: string) {
	const shell = resolveSiteShell({
		config,
		language,
		currentSlug,
		navigation,
		company,
		contacts: rawContacts,
		localLogo,
		mapQuery: MAP_QUERY,
	});
	return {
		...shell,
		heroActions: withMenuAction(
			shell.heroActions,
			language,
			pagePath(language, MENU_NAV_ENTRY.slug, config),
		),
	};
}
