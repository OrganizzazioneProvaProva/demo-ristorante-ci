import type { Language, SiteConfig } from "@siti/config";
import { z } from "zod";
import {
	type LocalizedText,
	localizedTextSchema,
	textIn,
} from "./localized.ts";

/** Lo slug `home` è la pagina iniziale: sta su `/` (italiano) e su `/en/` (inglese). */
export const HOME_SLUG = "home";

/**
 * Pagina come arriva dalla query GROQ (con `"slug": slug.current`). Il livello che
 * parla con Sanity produce questa forma; qui si convalida prima di usarla (04 §3).
 */
export const rawPageSchema = z.object({
	_id: z.string().min(1),
	slug: z.string().regex(/^[a-z0-9-]+$/),
	title: localizedTextSchema,
	description: localizedTextSchema,
	/**
	 * Il titolare dichiara di voler pubblicare questa pagina solo nella lingua principale. Non
	 * cambia quali pagine esistono (decide la presenza del testo, nessun ripiego): cambia solo
	 * se una traduzione mancante è una dimenticanza o una scelta (`SkippedPage.intentional`).
	 */
	onlyDefaultLanguage: z.boolean().nullish(),
});
export type RawPage = z.infer<typeof rawPageSchema>;

export interface ResolvedPage {
	id: string;
	slug: string;
	language: Language;
	/** Percorso con barra finale: `/chi-siamo/`, `/en/chi-siamo/`, `/`, `/en/`. */
	path: string;
	title: string;
	description: string;
}

export type PageText = "title" | "description" | "heroTitle";

export interface SkippedPage {
	id: string;
	slug: string;
	language: Language;
	missing: PageText[];
	/**
	 * Vero se il titolare ha scelto di pubblicare solo nella lingua principale
	 * (`onlyDefaultLanguage`: `missing` è vuoto e la lingua non si genera nemmeno se è compilata);
	 * falso se la lingua manca per dimenticanza.
	 */
	intentional: boolean;
}

export function pagePath(
	language: Language,
	slug: string,
	config: Pick<SiteConfig, "defaultLanguage">,
): string {
	const prefix = language === config.defaultLanguage ? "" : `/${language}`;
	return slug === HOME_SLUG ? `${prefix}/` : `${prefix}/${slug}/`;
}

/** Una pagina da risolvere: i testi per lingua che servono perché esista in una lingua. */
export interface PageEntry {
	id: string;
	slug: string;
	onlyDefaultLanguage: boolean;
	/** `title` e `description` sono sempre richiesti; la home aggiunge `heroTitle`. */
	texts: {
		title: LocalizedText;
		description: LocalizedText;
		heroTitle?: LocalizedText;
	};
}

/**
 * Decide quali pagine esistono in quali lingue.
 *
 * - Lingua principale: tutti i testi richiesti sono obbligatori; se mancano la build si ferma.
 * - Altre lingue: se manca una traduzione la pagina NON viene generata (niente ripiego
 *   sull'italiano: una pagina /en/ con testo italiano sarebbe contenuto misto) e finisce
 *   nell'elenco `skipped`, da stampare nel riepilogo della build. `intentional` distingue la
 *   scelta del titolare (`onlyDefaultLanguage`) dalla dimenticanza.
 */
export function resolveEntries(
	entries: readonly PageEntry[],
	config: Pick<SiteConfig, "languages" | "defaultLanguage">,
): { pages: ResolvedPage[]; skipped: SkippedPage[] } {
	const pages: ResolvedPage[] = [];
	const skipped: SkippedPage[] = [];

	for (const entry of entries) {
		const required = Object.keys(entry.texts) as PageText[];
		for (const language of config.languages) {
			// Scelta del titolare: la pagina esiste solo nella lingua principale, anche se un'altra
			// lingua fosse già compilata (non si pubblica ciò che il titolare ha scelto di non pubblicare).
			if (entry.onlyDefaultLanguage && language !== config.defaultLanguage) {
				skipped.push({
					id: entry.id,
					slug: entry.slug,
					language,
					missing: [],
					intentional: true,
				});
				continue;
			}
			const values = Object.fromEntries(
				required.map((name) => [
					name,
					textIn(entry.texts[name] as LocalizedText, language),
				]),
			) as Record<PageText, string | undefined>;
			const missing = required.filter((name) => !values[name]);

			if (missing.length === 0) {
				pages.push({
					id: entry.id,
					slug: entry.slug,
					language,
					path: pagePath(language, entry.slug, config),
					title: values.title as string,
					description: values.description as string,
				});
			} else if (language === config.defaultLanguage) {
				throw new Error(
					`Pagina "${entry.slug}": in ${language} (lingua principale) manca ${missing.join(" e ")}. La build si ferma.`,
				);
			} else {
				skipped.push({
					id: entry.id,
					slug: entry.slug,
					language,
					missing,
					intentional: entry.onlyDefaultLanguage,
				});
			}
		}
	}

	return { pages, skipped };
}

/** Controlla che nessuno slug compaia due volte (la home usa lo slug riservato `home`). */
export function assertUniqueSlugs(slugs: readonly string[]): void {
	const seen = new Set<string>();
	for (const slug of slugs) {
		if (seen.has(slug)) throw new Error(`Slug duplicato: "${slug}"`);
		seen.add(slug);
	}
}

/**
 * Le pagine `page` del sito (NON la home: lo slug `home` è riservato, la home è il documento
 * `home` e si risolve con `resolveSitePages`).
 */
export function resolvePages(
	rawPages: unknown,
	config: Pick<SiteConfig, "languages" | "defaultLanguage">,
): { pages: ResolvedPage[]; skipped: SkippedPage[] } {
	const parsed = z.array(rawPageSchema).parse(rawPages);
	assertUniqueSlugs(parsed.map((page) => page.slug));
	if (parsed.some((page) => page.slug === HOME_SLUG)) {
		throw new Error(
			`Lo slug "${HOME_SLUG}" è riservato alla home (documento "home"): una pagina non può usarlo. La build si ferma.`,
		);
	}
	return resolveEntries(
		parsed.map((page) => ({
			id: page._id,
			slug: page.slug,
			onlyDefaultLanguage: page.onlyDefaultLanguage === true,
			texts: { title: page.title, description: page.description },
		})),
		config,
	);
}

export interface Alternate {
	hreflang: Language | "x-default";
	path: string;
}

/**
 * Le versioni di una pagina per i link `hreflang`: ogni lingua in cui esiste (compresa la
 * pagina stessa), più `x-default` verso la lingua principale. Se la pagina esiste in una
 * sola lingua non serve nessun link.
 */
export function alternatesFor(
	page: Pick<ResolvedPage, "id">,
	allPages: readonly ResolvedPage[],
	config: Pick<SiteConfig, "languages" | "defaultLanguage">,
): Alternate[] {
	const versions = config.languages
		.map((language) =>
			allPages.find((p) => p.id === page.id && p.language === language),
		)
		.filter((p): p is ResolvedPage => p !== undefined);

	if (versions.length < 2) return [];

	const alternates: Alternate[] = versions.map((p) => ({
		hreflang: p.language,
		path: p.path,
	}));
	const main = versions.find((p) => p.language === config.defaultLanguage);
	if (main) alternates.push({ hreflang: "x-default", path: main.path });
	return alternates;
}

export type { LocalizedText };
