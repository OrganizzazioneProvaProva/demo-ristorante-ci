import type { Language, SiteConfig } from "@siti/config";
import { HOME_SLUG, pagePath } from "./pages.ts";

export const NOT_FOUND_LABELS: Record<
	Language,
	{
		title: string;
		description: string;
		home: string;
		contacts: string;
	}
> = {
	it: {
		title: "Pagina non trovata",
		description:
			"La pagina che cerchi potrebbe essere stata spostata o rimossa.",
		home: "Torna alla home",
		contacts: "Contatti",
	},
	en: {
		title: "Page not found",
		description: "The page you’re looking for may have moved or been removed.",
		home: "Back to home",
		contacts: "Contact",
	},
};

export function notFoundPath(
	language: Language,
	config: Pick<SiteConfig, "defaultLanguage">,
): string {
	return `${pagePath(language, HOME_SLUG, config)}404.html`;
}
