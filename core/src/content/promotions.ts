import {
	type ContentLinkPolicy,
	dateRangeError,
	isPromotionLink,
	type Language,
	resolvePromotionLink,
	type SiteConfig,
} from "@siti/config";
import { z } from "zod";
import { type ResolvedImage, rawImageSchema, resolveImage } from "./images.ts";
import { localizedTextSchema, textIn } from "./localized.ts";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "serve AAAA-MM-GG");

/** Solo https, mailto e tel (04 §3). */
const linkSchema = z.string().refine(isPromotionLink, "link non ammesso");

const validityRefine = <
	T extends { validFrom?: string | null; validTo?: string | null },
>(
	item: T,
) =>
	dateRangeError(item.validFrom ?? undefined, item.validTo ?? undefined) ===
	undefined;

export const rawPromotionSchema = z
	.object({
		_id: z.string().min(1),
		title: localizedTextSchema,
		description: localizedTextSchema.nullish(),
		image: rawImageSchema.nullish(),
		validFrom: dateSchema.nullish(),
		validTo: dateSchema.nullish(),
		link: linkSchema.nullish(),
		/**
		 * Il titolare ha scelto di pubblicare solo nella lingua principale: nelle altre lingue
		 * l'elemento non compare anche se compilato (`SkippedItem.intentional`). Pensato per gli
		 * avvisi urgenti («chiuso oggi») scritti subito in una lingua sola.
		 */
		onlyDefaultLanguage: z.boolean().nullish(),
	})
	.refine(validityRefine, "la data finale è prima di quella iniziale");

export const rawNoticeSchema = z
	.object({
		_id: z.string().min(1),
		message: localizedTextSchema,
		validFrom: dateSchema.nullish(),
		validTo: dateSchema.nullish(),
		/**
		 * Il titolare ha scelto di pubblicare solo nella lingua principale: nelle altre lingue
		 * l'elemento non compare anche se compilato (`SkippedItem.intentional`). Pensato per gli
		 * avvisi urgenti («chiuso oggi») scritti subito in una lingua sola.
		 */
		onlyDefaultLanguage: z.boolean().nullish(),
	})
	.refine(validityRefine, "la data finale è prima di quella iniziale");

export interface ResolvedPromotion {
	id: string;
	title: string;
	description?: string;
	image?: ResolvedImage;
	link?: string;
	/** Primo e ultimo giorno di validità (compresi), se ci sono: il browser li usa per nascondere. */
	validFrom?: string;
	validTo?: string;
}

export interface ResolvedNotice {
	id: string;
	message: string;
	validFrom?: string;
	validTo?: string;
}

export interface SkippedItem {
	id: string;
	language: Language;
	/** Cosa manca; assente se l'elemento non c'è per scelta del titolare. */
	missing?: "title" | "message";
	/** Vero se il titolare ha scelto di non pubblicarlo in questa lingua (`onlyDefaultLanguage`). */
	intentional: boolean;
}

/** Valida nel giorno indicato (AAAA-MM-GG): gli estremi sono compresi; senza estremi, sempre. */
export function isActiveOn(
	item: { validFrom?: string | null; validTo?: string | null },
	today: string,
): boolean {
	if (item.validFrom && today < item.validFrom) return false;
	if (item.validTo && today > item.validTo) return false;
	return true;
}

/**
 * Promozioni attive oggi, nella lingua richiesta. Una promozione scaduta o non ancora
 * valida non compare. Senza titolo nella lingua principale la build si ferma; senza titolo
 * in un'altra lingua la promozione non si mostra in quella lingua (nessun ripiego).
 */
export function resolvePromotions(
	rawItems: unknown,
	language: Language,
	today: string,
	config: Pick<SiteConfig, "defaultLanguage"> & ContentLinkPolicy,
): { items: ResolvedPromotion[]; skipped: SkippedItem[] } {
	const items: ResolvedPromotion[] = [];
	const skipped: SkippedItem[] = [];

	for (const raw of z.array(rawPromotionSchema).parse(rawItems)) {
		const link = raw.link ? resolvePromotionLink(raw.link, config) : undefined;
		if (!isActiveOn(raw, today)) continue;
		if (raw.onlyDefaultLanguage && language !== config.defaultLanguage) {
			skipped.push({ id: raw._id, language, intentional: true });
			continue;
		}
		const title = textIn(raw.title, language);
		if (!title) {
			if (language === config.defaultLanguage) {
				throw new Error(
					`Promozione ${raw._id}: manca il titolo in ${language} (lingua principale). La build si ferma.`,
				);
			}
			skipped.push({
				id: raw._id,
				language,
				missing: "title",
				intentional: false,
			});
			continue;
		}
		const description = raw.description
			? textIn(raw.description, language)
			: undefined;
		const image = raw.image
			? resolveImage(raw.image, language, config)
			: undefined;
		items.push({
			id: raw._id,
			title,
			...(description ? { description } : {}),
			...(image ? { image } : {}),
			...(link ? { link } : {}),
			...(raw.validFrom ? { validFrom: raw.validFrom } : {}),
			...(raw.validTo ? { validTo: raw.validTo } : {}),
		});
	}
	return { items, skipped };
}

/** Avvisi del giorno attivi oggi, nella lingua richiesta (stesse regole delle promozioni). */
export function resolveNotices(
	rawItems: unknown,
	language: Language,
	today: string,
	config: Pick<SiteConfig, "defaultLanguage">,
): { items: ResolvedNotice[]; skipped: SkippedItem[] } {
	const items: ResolvedNotice[] = [];
	const skipped: SkippedItem[] = [];

	for (const raw of z.array(rawNoticeSchema).parse(rawItems)) {
		if (!isActiveOn(raw, today)) continue;
		if (raw.onlyDefaultLanguage && language !== config.defaultLanguage) {
			skipped.push({ id: raw._id, language, intentional: true });
			continue;
		}
		const message = textIn(raw.message, language);
		if (!message) {
			if (language === config.defaultLanguage) {
				throw new Error(
					`Avviso ${raw._id}: manca il messaggio in ${language} (lingua principale). La build si ferma.`,
				);
			}
			skipped.push({
				id: raw._id,
				language,
				missing: "message",
				intentional: false,
			});
			continue;
		}
		items.push({
			id: raw._id,
			message,
			...(raw.validFrom ? { validFrom: raw.validFrom } : {}),
			...(raw.validTo ? { validTo: raw.validTo } : {}),
		});
	}
	return { items, skipped };
}
