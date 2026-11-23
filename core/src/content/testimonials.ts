import type { Language, SiteConfig } from "@siti/config";
import { z } from "zod";
import { localizedTextSchema, textIn } from "./localized.ts";

/**
 * Testimonianze dei clienti come arrivano da Sanity (un documento `testimonial` per ognuna). Le
 * scrive il titolare, che risponde del consenso di chi parla: il sito non copia recensioni da
 * altri servizi. Nessuna foto: l'avatar è l'iniziale del nome.
 */
export const rawTestimonialSchema = z.object({
	_id: z.string().min(1),
	author: z.string().trim().min(1),
	/** Ruolo o fonte ("Cliente abituale", "Google"), per lingua. */
	role: localizedTextSchema.nullish(),
	rating: z.number().int().min(1).max(5).nullish(),
	text: localizedTextSchema,
});
export type RawTestimonial = z.infer<typeof rawTestimonialSchema>;

export interface ResolvedTestimonial {
	id: string;
	author: string;
	initial: string;
	role?: string;
	rating?: number;
	text: string;
	/** Lingua del testo se non è quella della pagina: va scritta come `lang` (WCAG 3.1.2). */
	textLang?: Language;
}

/**
 * Le testimonianze nella lingua richiesta. Le parole di un cliente non si traducono al posto suo:
 * se manca il testo in questa lingua si mostra quello della lingua principale con `lang`, come per
 * le foto. Senza testo nella lingua principale la build si ferma. Il ruolo, se manca, non compare.
 */
export function resolveTestimonials(
	rawList: unknown,
	language: Language,
	config: Pick<SiteConfig, "defaultLanguage">,
): ResolvedTestimonial[] {
	const list = z.array(rawTestimonialSchema).parse(rawList);
	return list.map((raw) => {
		const own = textIn(raw.text, language);
		const main = textIn(raw.text, config.defaultLanguage);
		if (!main) {
			throw new Error(
				`Testimonianza di ${raw.author}: manca il testo in ${config.defaultLanguage} (lingua principale). La build si ferma.`,
			);
		}
		const text = own ?? main;
		const role = raw.role ? textIn(raw.role, language) : undefined;
		return {
			id: raw._id,
			author: raw.author,
			initial:
				[...raw.author].find((c) => /\p{L}/u.test(c))?.toUpperCase() ?? "•",
			...(role ? { role } : {}),
			...(raw.rating ? { rating: raw.rating } : {}),
			text,
			...(own ? {} : { textLang: config.defaultLanguage }),
		};
	});
}
