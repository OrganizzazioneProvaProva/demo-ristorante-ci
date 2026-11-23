import type { Language, SiteConfig } from "@siti/config";
import { z } from "zod";
import { type ResolvedImage, rawImageSchema, resolveImage } from "./images.ts";

/**
 * Foto minime per il ventaglio (`Gallery variant="fan"`): è un ciclo infinito con 5 foto visibili da
 * computer più una di scorta per lato, quindi `2 × 2 + 2`. Con meno la galleria è la fila scorrevole.
 */
export const FAN_MIN_IMAGES = 6;

/** La galleria come arriva da Sanity (documento `gallery`): da 1 a 30 immagini, nell'ordine. */
export const rawGallerySchema = z.object({
	images: z.array(rawImageSchema).min(1).max(30),
});

/**
 * Le immagini della galleria nella lingua richiesta, nell'ordine dello Studio. Un'immagine
 * non decorativa senza testo alternativo nella lingua principale ferma la build; senza testo
 * alternativo in un'altra lingua si mostra con l'alt della lingua principale e `lang`, salvo
 * le immagini `informative`, che si saltano e si contano in `skipped` (riepilogo della build).
 * Se dopo il salto `images` è vuoto, in quella lingua la galleria non ha immagini da
 * mostrare: sta alla pagina decidere (da chiarire con il proprietario, vedi esito).
 */
export function resolveGallery(
	rawGallery: unknown,
	language: Language,
	config: Pick<SiteConfig, "defaultLanguage">,
): { images: ResolvedImage[]; skipped: number } {
	const { images: raws } = rawGallerySchema.parse(rawGallery);
	const images: ResolvedImage[] = [];
	for (const raw of raws) {
		const image = resolveImage(raw, language, config);
		if (image) images.push(image);
	}
	return { images, skipped: raws.length - images.length };
}
