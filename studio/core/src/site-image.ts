import { defineField, defineType } from "sanity";

/** Solo raster (04 §3): niente SVG caricati dal cliente. */
export const IMAGE_FORMATS = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/avif",
] as const;

/** Avviso fisso richiesto da 02/04: in Sanity tutto ciò che si carica è pubblico. */
export const PUBLIC_UPLOAD_NOTICE =
	"Tutto ciò che carichi è pubblico: le immagini restano raggiungibili anche se non le usi più.";

/** Un campo immagine può esistere prima che sia stato selezionato un file. */
export function requiresImageAlt(image: unknown): boolean {
	const value = image as
		| { asset?: { _ref?: unknown }; decorative?: unknown }
		| undefined;
	const reference = value?.asset?._ref;
	return (
		typeof reference === "string" &&
		reference.length > 0 &&
		value?.decorative !== true
	);
}

/**
 * Immagine del sito con testo alternativo per lingua (02: obbligatorio, con l'opzione
 * "decorativa" che produce `alt=""`). Il formato è limitato con `accept`; il controllo
 * definitivo sull'estensione dell'asset si fa nello strato dati del sito (04 §3).
 *
 * Il testo alternativo è un oggetto `altText` (un campo per lingua). Si mostra e si valida
 * quando è stato selezionato un file e la foto non è decorativa. L'obbligo sull'italiano
 * è verificato nel campo della lingua (vedi `altTextType`). `required()` sull'oggetto
 * permette a Sanity di validare i campi interni anche quando l'alt non è ancora compilato.
 */
export const siteImageType = defineType({
	name: "siteImage",
	title: "Immagine",
	type: "image",
	description: `${PUBLIC_UPLOAD_NOTICE} Formati: JPEG, PNG, WebP, AVIF.`,
	options: { hotspot: true, accept: IMAGE_FORMATS.join(",") },
	fields: [
		defineField({
			name: "decorative",
			title: "Immagine decorativa",
			type: "boolean",
			description:
				"Spunta solo se l'immagine non aggiunge informazioni (resta senza testo alternativo).",
			initialValue: false,
		}),
		defineField({
			name: "informative",
			title: "L'immagine contiene informazioni",
			type: "boolean",
			description:
				"Spunta se l'immagine porta contenuto che il testo non ripete (menu fotografato, cartello, orari). Senza traduzione del testo alternativo, nelle altre lingue non verrà mostrata; le foto normali compaiono invece con il testo italiano.",
			initialValue: false,
			hidden: ({ parent }) => parent?.decorative === true,
		}),
		defineField({
			name: "alt",
			title: "Testo alternativo",
			type: "altText",
			description:
				"Descrivi cosa si vede, per chi non può vedere l'immagine. Non scrivere «foto di».",
			hidden: ({ parent }) => !requiresImageAlt(parent),
			validation: (rule, context) =>
				context?.hidden ? rule.skip() : rule.required(),
		}),
	],
});
