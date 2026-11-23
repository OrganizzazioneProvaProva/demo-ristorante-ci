import {
	type ContentLinkPolicy,
	type Language,
	requireContentHttpsLink,
	type SiteConfig,
} from "@siti/config";
import { z } from "zod";
import { type ResolvedImage, rawImageSchema, resolveImage } from "./images.ts";
import { contentHttpsLinkSchema } from "./links.ts";
import { localizedTextSchema, textIn } from "./localized.ts";

/**
 * Valutazione pubblica del locale: solo un riepilogo e il link alla fonte (https). Niente
 * testo di recensioni di persone.
 */
const socialProofSchema = z.object({
	rating: z
		.number()
		.min(1)
		.max(5)
		.refine(
			(n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-6,
			"al massimo un decimale",
		),
	reviewCount: z.number().int().min(1).nullish(),
	sourceName: z.string().trim().min(1),
	sourceUrl: contentHttpsLinkSchema,
});

/** La home come arriva da Sanity (documento `home`). */
export const rawHomeSchema = z.object({
	/** SEO: titolo e descrizione della pagina per i motori di ricerca, per lingua (02). */
	title: localizedTextSchema,
	description: localizedTextSchema,
	/** Vedi `RawPage.onlyDefaultLanguage`: la home esiste solo nella lingua principale. */
	onlyDefaultLanguage: z.boolean().nullish(),
	heroTitle: localizedTextSchema,
	heroSubtitle: localizedTextSchema.nullish(),
	heroImage: rawImageSchema.nullish(),
	storyTitle: localizedTextSchema.nullish(),
	storyText: localizedTextSchema.nullish(),
	socialProof: socialProofSchema.nullish(),
});

export interface ResolvedHome {
	hero: { title: string; subtitle?: string; image?: ResolvedImage };
	story?: { title?: string; text: string };
	socialProof?: z.infer<typeof socialProofSchema>;
}

/**
 * La home nella lingua richiesta. Senza titolo nella lingua principale la build si ferma;
 * senza titolo in un'altra lingua la home non esiste in quella lingua (`undefined`, nessun
 * ripiego). Sottotitolo e storia mancanti in una lingua semplicemente non compaiono; il
 * titolo della storia non compare senza il suo testo.
 */
export function resolveHome(
	rawHome: unknown,
	language: Language,
	config: Pick<SiteConfig, "defaultLanguage"> & ContentLinkPolicy,
): ResolvedHome | undefined {
	const home = rawHomeSchema.parse(rawHome);
	if (home.socialProof)
		requireContentHttpsLink(
			home.socialProof.sourceUrl,
			"home.socialProof.sourceUrl",
			config,
		);
	const title = textIn(home.heroTitle, language);
	if (!title) {
		if (language === config.defaultLanguage) {
			throw new Error(
				`Home: manca il titolo principale in ${language} (lingua principale). La build si ferma.`,
			);
		}
		return undefined;
	}
	const subtitle = home.heroSubtitle
		? textIn(home.heroSubtitle, language)
		: undefined;
	const image = home.heroImage
		? resolveImage(home.heroImage, language, config)
		: undefined;
	const storyText = home.storyText
		? textIn(home.storyText, language)
		: undefined;
	const storyTitle = home.storyTitle
		? textIn(home.storyTitle, language)
		: undefined;
	return {
		hero: {
			title,
			...(subtitle ? { subtitle } : {}),
			...(image ? { image } : {}),
		},
		...(storyText
			? {
					story: {
						...(storyTitle ? { title: storyTitle } : {}),
						text: storyText,
					},
				}
			: {}),
		...(home.socialProof ? { socialProof: home.socialProof } : {}),
	};
}
