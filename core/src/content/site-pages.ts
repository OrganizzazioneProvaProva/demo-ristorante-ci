import type { ContentLinkPolicy, Language, SiteConfig } from "@siti/config";
import { z } from "zod";
import { rawHomeSchema, resolveHome } from "./home.ts";
import { withLegalPages } from "./legal.ts";
import {
	alternatesFor,
	assertUniqueSlugs,
	HOME_SLUG,
	type PageEntry,
	type ResolvedPage,
	rawPageSchema,
	resolveEntries,
	type SkippedPage,
} from "./pages.ts";

/**
 * Tutte le pagine del sito: la home (documento `home`) più le `page`. La home entra nello
 * stesso risolutore delle altre pagine (adattatore verso `RawPage`): stesse regole per le
 * lingue, stessi hreflang, stesso controllo degli slug. Per esistere in una lingua la home
 * vuole titolo SEO, descrizione E titolo principale (`heroTitle`) in quella lingua.
 */
export function resolveSitePages(
	rawHome: unknown,
	rawPages: unknown,
	config: Pick<SiteConfig, "languages" | "defaultLanguage">,
): { pages: ResolvedPage[]; skipped: SkippedPage[] } {
	const home = rawHomeSchema.parse(rawHome);
	const pages = z.array(rawPageSchema).parse(rawPages);
	if (pages.some((page) => page.slug === HOME_SLUG)) {
		throw new Error(
			`Lo slug "${HOME_SLUG}" è riservato alla home (documento "home"): una pagina non può usarlo. La build si ferma.`,
		);
	}
	assertUniqueSlugs([HOME_SLUG, ...pages.map((page) => page.slug)]);

	const entries: PageEntry[] = [
		{
			id: "home",
			slug: HOME_SLUG,
			onlyDefaultLanguage: home.onlyDefaultLanguage === true,
			texts: {
				title: home.title,
				description: home.description,
				heroTitle: home.heroTitle,
			},
		},
		...pages.map((page) => ({
			id: page._id,
			slug: page.slug,
			onlyDefaultLanguage: page.onlyDefaultLanguage === true,
			texts: { title: page.title, description: page.description },
		})),
	];
	return resolveEntries(entries, config);
}

export function createSitePages(
	rawHome: unknown,
	rawPages: unknown,
	config: Pick<SiteConfig, "languages" | "defaultLanguage"> & ContentLinkPolicy,
) {
	const { pages: resolved, skipped } = resolveSitePages(
		rawHome,
		rawPages,
		config,
	);
	const pages = withLegalPages(resolved, config);

	return {
		pages,
		skipped,
		pageFor(slug: string, language: Language) {
			const page = pages.find(
				(p) => p.language === language && p.slug === slug,
			);
			if (!page)
				throw new Error(`Pagina "${slug}" non disponibile in ${language}`);
			return { page, alternates: alternatesFor(page, pages, config) };
		},
		homeFor(language: Language) {
			const home = resolveHome(rawHome, language, config);
			const page = pages.find(
				(p) => p.language === language && p.slug === HOME_SLUG,
			);
			if (!home || !page)
				throw new Error(`Home non disponibile in ${language}`);
			return { home, page, alternates: alternatesFor(page, pages, config) };
		},
	};
}
