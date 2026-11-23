/**
 * Indirizzi delle pagine legali obbligatorie del core (privacy, cookie, note legali, accessibilità).
 * Stanno nel pacchetto neutro perché li leggono sia il sito (che genera le pagine) sia lo Studio
 * (che avvisa se una pagina del titolare prova a usarli).
 */
export const LEGAL_SLUGS = [
	"privacy",
	"cookie",
	"note-legali",
	"accessibilita",
] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export function isLegalSlug(value: string): value is LegalSlug {
	return (LEGAL_SLUGS as readonly string[]).includes(value);
}
