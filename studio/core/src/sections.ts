import { dateRangeError, isPromotionLink } from "@siti/config";
import { defineField, defineType } from "sanity";
import type { LocaleOptions } from "./locale.ts";
import { onlyDefaultLanguageField } from "./translation-rules.ts";

/** Link: solo https, mailto e tel (04 §3). */
const linkField = defineField({
	name: "link",
	title: "Link (facoltativo)",
	type: "url",
	validation: (rule) =>
		rule
			.uri({ scheme: ["https", "mailto", "tel"], allowRelative: false })
			.custom((value) =>
				value === undefined ||
				value.startsWith("tel:") ||
				isPromotionLink(value)
					? true
					: "Serve un link https valido, mailto senza parametri o tel.",
			),
});

/** Galleria: un solo documento per sito, con le immagini nell'ordine in cui compaiono. */
export const galleryType = defineType({
	name: "gallery",
	title: "Galleria",
	type: "document",
	fields: [
		defineField({
			name: "images",
			title: "Immagini",
			type: "array",
			of: [{ type: "siteImage" }],
			validation: (rule) => rule.required().min(1).max(30),
		}),
	],
	preview: { prepare: () => ({ title: "Galleria" }) },
});

/** Promozione con periodo di validità: scade da sola (il controllo notturno ricostruisce il sito). */
export function promotionType(options: LocaleOptions) {
	return defineType({
		name: "promotion",
		title: "Promozione",
		type: "document",
		fields: [
			defineField({
				name: "title",
				title: "Titolo",
				type: "localeStringRequired",
				validation: (rule) => rule.required(),
			}),
			onlyDefaultLanguageField(options),
			defineField({
				name: "description",
				title: "Descrizione",
				type: "localeText",
			}),
			defineField({ name: "image", title: "Immagine", type: "siteImage" }),
			defineField({
				name: "validFrom",
				title: "Valida dal (facoltativo)",
				type: "date",
			}),
			defineField({
				name: "validTo",
				title: "Valida fino al (compreso, facoltativo)",
				type: "date",
				validation: (rule) =>
					rule.custom((value, context) => {
						const from = (context.parent as { validFrom?: string } | undefined)
							?.validFrom;
						return dateRangeError(from, value as string | undefined) ?? true;
					}),
			}),
			linkField,
		],
		preview: {
			select: { title: "title.it", media: "image", to: "validTo" },
			prepare: ({ title, media, to }) => ({
				title,
				media,
				subtitle: to ? `fino al ${to}` : "senza scadenza",
			}),
		},
	});
}

/** Avviso del giorno: un messaggio breve in evidenza, con periodo di validità. */
export function noticeType(options: LocaleOptions) {
	return defineType({
		name: "notice",
		title: "Avviso",
		type: "document",
		fields: [
			defineField({
				name: "message",
				title: "Messaggio",
				type: "localeStringRequired",
				validation: (rule) => rule.required(),
			}),
			onlyDefaultLanguageField(options),
			defineField({
				name: "validFrom",
				title: "Visibile dal (facoltativo)",
				type: "date",
			}),
			defineField({
				name: "validTo",
				title: "Visibile fino al (compreso, facoltativo)",
				type: "date",
				validation: (rule) =>
					rule.custom((value, context) => {
						const from = (context.parent as { validFrom?: string } | undefined)
							?.validFrom;
						return dateRangeError(from, value as string | undefined) ?? true;
					}),
			}),
		],
		preview: { select: { title: "message.it" } },
	});
}
