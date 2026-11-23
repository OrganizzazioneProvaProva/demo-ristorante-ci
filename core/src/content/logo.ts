import {
	type Language,
	type SiteConfig,
	SUPPORTED_LANGUAGES,
} from "@siti/config";
import type { ImageMetadata } from "astro";
import {
	type RawImage,
	type ResolvedImage,
	resolveImage,
	resolveLocalImage,
} from "./images.ts";

/**
 * Logo dell'attività per il piè di pagina. Due strade, nell'ordine:
 * 1. il campo `logo` dello Studio (JPEG, PNG, WebP, AVIF: lo Studio non accetta SVG, perché un
 *    SVG caricato può contenere script, `04` §3);
 * 2. un file del sito (`src/assets/logo.svg`, o PNG/WebP), messo da noi all'onboarding: è codice,
 *    non un dato del cliente, quindi può essere SVG. Non è un segnaposto.
 * Senza nessuno dei due il piè di pagina mostra il nome dell'attività in grande.
 * Il testo alternativo è il nome dell'attività, uguale in ogni lingua.
 */
export function resolveLogo(options: {
	studio?: RawImage | null;
	local?: ImageMetadata;
	name: string;
	language: Language;
	config: Pick<SiteConfig, "defaultLanguage">;
}): ResolvedImage | undefined {
	const { studio, local, name, language, config } = options;
	if (studio) return resolveImage(studio, language, config);
	if (!local) return undefined;
	return resolveLocalImage(
		{
			src: local,
			placeholder: false,
			alt: Object.fromEntries(SUPPORTED_LANGUAGES.map((l) => [l, name])),
		},
		language,
		config,
	);
}
