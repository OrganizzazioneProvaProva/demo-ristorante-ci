import { contentHttpsHostname } from "@siti/config";
import { defineField, defineType } from "sanity";
import type { LocaleOptions } from "./locale.ts";
import { onlyDefaultLanguageField } from "./translation-rules.ts";

/**
 * Testi della home, modificabili dal titolare: un solo documento per sito. Titolo e foto
 * principale, la presentazione del locale e, se serve, la valutazione pubblica (prova
 * sociale). La prova sociale è solo un riepilogo con un link alla fonte: niente testo di
 * recensioni di persone (privacy e diritto d'autore).
 */
export function homeType(options: LocaleOptions) {
	return defineType({
		name: "home",
		title: "Home",
		type: "document",
		// In ogni lingua attiva servono titolo e descrizione per Google e titolo principale
		// (altrimenti la home non esiste in quella lingua): errore, salvo `onlyDefaultLanguage`.
		fields: [
			defineField({
				name: "title",
				title: "Titolo per Google (SEO)",
				type: "localeStringRequired",
				description:
					"Il titolo che compare nei risultati di ricerca e nella scheda del browser.",
				validation: (rule) => rule.required(),
			}),
			defineField({
				name: "description",
				title: "Descrizione per Google (SEO)",
				type: "localeTextRequired",
				validation: (rule) => rule.required(),
			}),
			onlyDefaultLanguageField(options),
			defineField({
				name: "heroTitle",
				title: "Titolo principale",
				type: "localeStringRequired",
				validation: (rule) => rule.required(),
			}),
			defineField({
				name: "heroSubtitle",
				title: "Sottotitolo (facoltativo)",
				type: "localeText",
			}),
			defineField({
				name: "heroImage",
				title: "Foto principale (facoltativa)",
				type: "siteImage",
			}),
			defineField({
				name: "storyTitle",
				title: "Titolo della presentazione (facoltativo)",
				type: "localeString",
			}),
			defineField({
				name: "storyText",
				title: "La nostra storia (facoltativa)",
				type: "localeText",
			}),
			defineField({
				name: "socialProof",
				title: "Valutazione online (facoltativa)",
				type: "object",
				description:
					"Un riepilogo della valutazione che hai su un sito pubblico, con il link per leggerla. Non copiare le recensioni delle persone.",
				fields: [
					defineField({
						name: "rating",
						title: "Valutazione (da 1 a 5)",
						type: "number",
						validation: (rule) => rule.required().min(1).max(5).precision(1),
					}),
					defineField({
						name: "reviewCount",
						title: "Numero di recensioni (facoltativo)",
						type: "number",
						validation: (rule) => rule.integer().min(1),
					}),
					defineField({
						name: "sourceName",
						title: "Dove (per esempio Google)",
						type: "string",
						validation: (rule) => rule.required(),
					}),
					defineField({
						name: "sourceUrl",
						title: "Link alle recensioni",
						type: "url",
						description:
							"Il link alla scheda Google dell'attività, nella sezione delle recensioni. In Google Maps cerca la tua attività, apri «Recensioni», scegli «Condividi» e copia il link.",
						validation: (rule) =>
							rule
								.required()
								.custom((value) =>
									value === undefined || contentHttpsHostname(value)
										? true
										: "Serve un indirizzo https valido senza credenziali, IP o localhost.",
								),
					}),
				],
			}),
		],
		preview: { prepare: () => ({ title: "Home" }) },
	});
}
