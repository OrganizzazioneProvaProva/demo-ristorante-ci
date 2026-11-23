import type { Language } from "@siti/config";
import type { CompanyInfo } from "./company.ts";
import { escapeXml } from "./xml.ts";

/**
 * Titolo del documento (02, "Title, description e anteprima social"): regola fissa
 * "Pagina · Attività · Città". Le parti uguali si scrivono una volta sola ("Ristorante X" come
 * titolo della home diventa "Ristorante X · Piazza Armerina").
 */
export function documentTitle(
	pageTitle: string,
	company: Pick<CompanyInfo, "name" | "address">,
): string {
	const parts: string[] = [];
	for (const part of [pageTitle, company.name, company.address.city]) {
		const text = part.trim();
		if (text && !parts.some((p) => p.toLowerCase() === text.toLowerCase())) {
			parts.push(text);
		}
	}
	return parts.join(" · ");
}

/** Lingua nel formato di Open Graph (`og:locale`). */
export const OG_LOCALES: Record<Language, string> = {
	it: "it_IT",
	en: "en_GB",
};

/** Indirizzo dell'icona del sito: la genera una piccola rotta del sito (`monogramSvg`). */
export const FAVICON_PATH = "/favicon.svg";

/**
 * Icona del sito generata al build (02, "Favicon"): senza logo, il monogramma con l'iniziale
 * dell'attività sul colore del tema. SVG: per la sola icona vettoriale; le versioni raster
 * (`.ico`, `apple-touch-icon`, manifest) non ci sono ancora.
 */
export function monogramSvg(options: {
	name: string;
	background: string;
	foreground: string;
}): string {
	const letter = [...options.name.trim()].find((c) => /\p{L}/u.test(c)) ?? "•";
	const hex = /^#[0-9a-f]{6}$/i;
	if (!hex.test(options.background) || !hex.test(options.foreground)) {
		throw new Error(
			"I colori del monogramma devono essere #rrggbb. La build si ferma.",
		);
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${options.background}"/><text x="16" y="23" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="${options.foreground}">${escapeXml(letter.toUpperCase())}</text></svg>`;
}
