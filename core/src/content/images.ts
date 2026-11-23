import type { Language, SiteConfig } from "@siti/config";
import type { ImageMetadata } from "astro";
import { z } from "zod";
import { localizedTextSchema, textIn } from "./localized.ts";

/**
 * Le immagini arrivano dal CDN di Sanity (`asset->url` nella query GROQ). Si accettano solo
 * quell'host e solo JPEG, PNG, WebP, AVIF (04 §3: niente SVG caricati dal cliente, niente
 * indirizzi esterni): il controllo sull'estensione dell'asset, che lo Studio non può fare.
 */
const IMAGE_URL =
	/^https:\/\/cdn\.sanity\.io\/images\/[a-z0-9]+\/[a-z0-9_-]+\/[^?#\s]+\.(?:jpe?g|png|webp|avif)$/i;

export const rawImageSchema = z.object({
	asset: z.object({
		url: z.string().regex(IMAGE_URL, "immagine non ammessa (host o formato)"),
		width: z.number().int().positive().nullish(),
		height: z.number().int().positive().nullish(),
	}),
	decorative: z.boolean().nullish(),
	/**
	 * Vero se l'immagine porta informazione che il testo non ripete (menu fotografato,
	 * cartello, planimetria). Serve solo quando manca l'alt nella lingua richiesta: una foto
	 * "informativa" non si mostra con l'alt di un'altra lingua.
	 */
	informative: z.boolean().nullish(),
	alt: localizedTextSchema.nullish(),
});
export type RawImage = z.infer<typeof rawImageSchema>;

export interface ResolvedImage {
	url: string;
	width?: number;
	height?: number;
	/** Testo alternativo nella lingua richiesta; stringa vuota se l'immagine è decorativa. */
	alt: string;
	/**
	 * Lingua del testo alternativo se diversa da quella della pagina: va scritta come
	 * `lang` sull'`<img>` (WCAG 3.1.2, parti in un'altra lingua).
	 */
	lang?: Language;
	/**
	 * Solo per i SEGNAPOSTO: l'immagine locale (import di un file del sito, ottimizzata da
	 * `<Image>`). Le foto vere hanno solo `url` (CDN di Sanity). Vedi `resolveLocalImage`.
	 */
	local?: ImageMetadata;
	/**
	 * Vero se l'immagine locale è un SEGNAPOSTO da sostituire con la foto vera (il componente
	 * scrive `data-placeholder` e `check-site` vieta i segnaposto nei siti dei clienti). Falso
	 * per un file locale che è l'immagine vera (per esempio il logo).
	 */
	placeholder?: boolean;
}

type AltSource = Pick<RawImage, "decorative" | "informative" | "alt">;

/**
 * Regole del testo alternativo, uguali per le foto di Sanity e per i segnaposto locali.
 * `undefined` = l'immagine non si mostra in questa lingua.
 */
function resolveAlt(
	source: AltSource,
	label: string,
	language: Language,
	config: Pick<SiteConfig, "defaultLanguage">,
): { alt: string; lang?: Language } | undefined {
	if (source.decorative) return { alt: "" };

	const alt = source.alt ? textIn(source.alt, language) : undefined;
	if (alt) return { alt };
	const fallback = source.alt
		? textIn(source.alt, config.defaultLanguage)
		: undefined;
	if (language === config.defaultLanguage || !fallback) {
		throw new Error(
			`Immagine ${label}: manca il testo alternativo in ${config.defaultLanguage} (lingua principale) e non è decorativa. La build si ferma.`,
		);
	}
	if (source.informative) return undefined;
	return { alt: fallback, lang: config.defaultLanguage };
}

/**
 * Un'immagine pronta per una pagina in una lingua.
 *
 * - Decorativa: `alt=""`.
 * - Senza testo alternativo nella lingua principale: errore, la build si ferma (02: alt
 *   obbligatorio).
 * - Senza testo alternativo nella lingua richiesta (non principale): una foto non
 *   informativa si mostra con l'alt della lingua principale e `lang` valorizzato (eccezione
 *   dichiarata alla regola "nessun ripiego": il testo alternativo non è contenuto della
 *   pagina e WCAG 3.1.2 ammette parti in un'altra lingua); un'immagine `informative`
 *   non si mostra (`undefined`).
 */
export function resolveImage(
	raw: RawImage,
	language: Language,
	config: Pick<SiteConfig, "defaultLanguage">,
): ResolvedImage | undefined {
	const resolved = resolveAlt(raw, raw.asset.url, language, config);
	if (!resolved) return undefined;
	return {
		url: raw.asset.url,
		...(raw.asset.width ? { width: raw.asset.width } : {}),
		...(raw.asset.height ? { height: raw.asset.height } : {}),
		...resolved,
	};
}

/**
 * Larghezza e altezza di una foto REMOTA (le vuole `<Image>`: senza, Astro dovrebbe
 * scaricarla per misurarla). Se mancano la build si ferma: la query GROQ deve restituire
 * `asset->metadata.dimensions`. I segnaposto locali non passano da qui (le ricava l'import).
 */
export function requireDimensions(image: ResolvedImage): {
	width: number;
	height: number;
} {
	if (!image.width || !image.height) {
		throw new Error(
			`Immagine ${image.url}: mancano larghezza e altezza (la query GROQ deve restituire asset->metadata.dimensions). La build si ferma.`,
		);
	}
	return { width: image.width, height: image.height };
}

/**
 * SEGNAPOSTO: un'immagine locale (file del sito importato con `import x from "..."`) al
 * posto della foto che arriverà da Sanity. Passa dalle stesse regole di testo alternativo e
 * `lang` di `resolveImage`, così quando la foto vera sostituisce il segnaposto la pagina
 * non cambia. NON passa dal controllo dell'host (`IMAGE_URL`): è codice del sito, non un
 * dato del cliente. Il componente `SiteImage` marca l'`<img>` con `data-placeholder` e il
 * controllo del sito (`checkSite`) vieta i segnaposto fuori dai siti `prova`/`demo-*`.
 */
export interface LocalImage extends AltSource {
	src: ImageMetadata;
	/** Obbligatorio: chi usa un file locale deve dire se è un segnaposto o l'immagine vera. */
	placeholder: boolean;
}

/**
 * L'import di un file immagine è un oggetto (JPEG, PNG…) o, per gli SVG, una funzione
 * (componente) che porta le stesse proprietà: si controllano le proprietà, non il tipo.
 */
const importedImageSchema = z.custom<ImageMetadata>((value) => {
	if (typeof value !== "object" && typeof value !== "function") return false;
	if (value === null) return false;
	const meta = value as Partial<Record<keyof ImageMetadata, unknown>>;
	return (
		typeof meta.src === "string" &&
		meta.src.length > 0 &&
		Number.isInteger(meta.width) &&
		Number.isInteger(meta.height) &&
		typeof meta.format === "string"
	);
}, "serve un'immagine importata (src, width, height, format)");

const localImageSchema = z.object({
	src: importedImageSchema,
	placeholder: z.boolean(),
	decorative: z.boolean().nullish(),
	informative: z.boolean().nullish(),
	alt: localizedTextSchema.nullish(),
});

export function resolveLocalImage(
	raw: LocalImage,
	language: Language,
	config: Pick<SiteConfig, "defaultLanguage">,
): ResolvedImage | undefined {
	const parsed = localImageSchema.parse(raw);
	const resolved = resolveAlt(parsed, parsed.src.src, language, config);
	if (!resolved) return undefined;
	return {
		url: raw.src.src,
		width: raw.src.width,
		height: raw.src.height,
		local: raw.src,
		placeholder: parsed.placeholder,
		...resolved,
	};
}
