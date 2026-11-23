import { isLegalSlug } from "@siti/config";
import { defineField, defineType } from "sanity";
import type { LocaleOptions } from "./locale.ts";
import { onlyDefaultLanguageField } from "./translation-rules.ts";

/**
 * Pagina del sito. Titolo e descrizione SEO sono per lingua; lo slug è uno solo, uguale in
 * tutte le lingue (la pagina inglese sta su /en/<slug>/): così l'associazione hreflang tra
 * le versioni è automatica. Slug tradotti si potranno aggiungere dopo come campo facoltativo.
 */
export function pageType(options: LocaleOptions) {
	return defineType({
		name: "page",
		title: "Pagina",
		type: "document",
		fields: [
			defineField({
				name: "title",
				title: "Titolo",
				type: "localeStringRequired",
				validation: (rule) => rule.required(),
			}),
			defineField({
				name: "slug",
				title: "Indirizzo (slug)",
				type: "slug",
				options: { source: "title.it", maxLength: 80 },
				validation: (rule) =>
					rule.required().custom((value) => {
						const current = value?.current;
						if (current === "home") {
							return "«home» è riservato alla pagina iniziale (documento Home): scegli un altro indirizzo.";
						}
						if (current && isLegalSlug(current)) {
							return `«${current}» è una pagina legale che il sito crea da solo: questa pagina non verrà pubblicata. Scegli un altro indirizzo.`;
						}
						return current && !/^[a-z0-9-]+$/.test(current)
							? "Solo minuscole, cifre e trattini"
							: true;
					}),
			}),
			defineField({
				name: "description",
				title: "Descrizione per i motori di ricerca",
				type: "localeTextRequired",
				validation: (rule) => rule.required(),
			}),
			onlyDefaultLanguageField(options),
		],
	});
}
