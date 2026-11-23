import type { Language } from "@siti/config";
import { resolveLocalImage } from "@siti/core/content/images.ts";
import { localDateTime } from "@siti/core/content/opening-status.ts";
import {
	resolveNotices,
	resolvePromotions,
} from "@siti/core/content/promotions.ts";
import gallery from "../assets/placeholders/gallery.svg";
import { config } from "./home.ts";
import { content } from "./source.ts";

/** Oggi alla build: avvisi e promozioni del demo sono sempre validi nei giorni attorno alla build. */
const today = localDateTime(new Date()).date;

/** Avvisi e promozioni: dai documenti `notice` e `promotion` (o dai dati finti, vedi `source.ts`). */
export const rawNotices = content.notices;

export const rawPromotions = content.promotions;

export function offersFor(language: Language) {
	return {
		notices: resolveNotices(rawNotices, language, today, config).items,
		promotions: resolvePromotions(rawPromotions, language, today, config).items,
	};
}

/** Foto della galleria: SEGNAPOSTO locali (la stessa immagine con testi alternativi diversi). */
export function galleryFor(language: Language) {
	const alt = (n: number) => ({
		it: `Foto ${n + 1} di Azienda X`,
		en: `Photo ${n + 1} of Azienda X`,
	});
	return [1, 2, 3, 4, 5, 6].flatMap((n) => {
		const image = resolveLocalImage(
			{ src: gallery, placeholder: true, alt: alt(n) },
			language,
			config,
		);
		return image ? [image] : [];
	});
}
