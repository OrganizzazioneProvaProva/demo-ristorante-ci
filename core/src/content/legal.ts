import {
	isLegalSlug,
	type Language,
	LEGAL_SLUGS,
	type LegalSlug,
	type SiteConfig,
} from "@siti/config";
import type { CompanyInfo } from "./company.ts";
import { pagePath, type ResolvedPage } from "./pages.ts";

/**
 * Pagine obbligatorie (02, "Conformità: implementazione nel core"): informativa sulla privacy,
 * informativa sui cookie, note legali, accessibilità. Esistono in ogni sito e in ogni lingua e NON
 * dipendono dai documenti `page` dello Studio: se il titolare non le crea (o le cancella), il sito
 * non perde una pagina obbligatoria. Titoli e descrizioni stanno qui, in tutte le lingue del core.
 * I testi delle pagine stanno in `legal-text.ts`.
 */

export { isLegalSlug, LEGAL_SLUGS, type LegalSlug };

interface LegalPageText {
	title: string;
	description: string;
}

export interface LegalLabels {
	/** Etichetta della navigazione nel piè di pagina. */
	nav: string;
	pages: Record<LegalSlug, LegalPageText>;
	legalTypes: Record<CompanyInfo["legalType"], string>;
	facts: {
		name: string;
		legalType: string;
		address: string;
		vatNumber: string;
		reaNumber: string;
		shareCapital: string;
		email: string;
		phone: string;
	};
}

export const LEGAL_LABELS: Record<Language, LegalLabels> = {
	it: {
		nav: "Informazioni legali",
		pages: {
			privacy: {
				title: "Informativa sulla privacy",
				description:
					"Come vengono trattati i dati personali su questo sito (artt. 13 e 14 del Regolamento UE 2016/679).",
			},
			cookie: {
				title: "Informativa sui cookie",
				description:
					"Quali cookie e strumenti di memorizzazione usa questo sito.",
			},
			"note-legali": {
				title: "Note legali",
				description:
					"Dati dell'attività, condizioni di utilizzo del sito e informazioni obbligatorie.",
			},
			accessibilita: {
				title: "Accessibilità",
				description:
					"Impegno per l'accessibilità del sito e come segnalare un problema.",
			},
		},
		legalTypes: {
			"ditta-individuale": "Ditta individuale",
			"societa-di-persone": "Società di persone",
			"societa-di-capitali": "Società di capitali",
			professionista: "Professionista",
		},
		facts: {
			name: "Denominazione",
			legalType: "Tipo di soggetto",
			address: "Sede",
			vatNumber: "Partita IVA",
			reaNumber: "Numero REA",
			shareCapital: "Capitale sociale",
			email: "Email",
			phone: "Telefono",
		},
	},
	en: {
		nav: "Legal information",
		pages: {
			privacy: {
				title: "Privacy notice",
				description:
					"How personal data is processed on this website (Articles 13 and 14 of Regulation (EU) 2016/679).",
			},
			cookie: {
				title: "Cookie notice",
				description: "Which cookies and storage tools this website uses.",
			},
			"note-legali": {
				title: "Legal notice",
				description:
					"Business details, terms of use of the website and required information.",
			},
			accessibilita: {
				title: "Accessibility",
				description:
					"Our commitment to accessibility and how to report a problem.",
			},
		},
		legalTypes: {
			"ditta-individuale": "Sole proprietorship",
			"societa-di-persone": "Partnership",
			"societa-di-capitali": "Limited company",
			professionista: "Professional",
		},
		facts: {
			name: "Name",
			legalType: "Legal form",
			address: "Registered office",
			vatNumber: "VAT number",
			reaNumber: "REA number",
			shareCapital: "Share capital",
			email: "Email",
			phone: "Phone",
		},
	},
};

/** Voce di piè di pagina o link a una pagina legale. */
export interface LegalLink {
	label: string;
	href: string;
}

/** I link alle pagine legali nella lingua, nell'ordine del piè di pagina. */
export function legalLinks(
	language: Language,
	config: Pick<SiteConfig, "defaultLanguage">,
): LegalLink[] {
	return LEGAL_SLUGS.map((slug) => ({
		label: LEGAL_LABELS[language].pages[slug].title,
		href: pagePath(language, slug, config),
	}));
}

/**
 * Le pagine legali come pagine del sito (per hreflang e sitemap), in ogni lingua attiva. Se una
 * pagina `page` dello Studio usa uno slug legale, vince la pagina legale del core: quella dello
 * Studio si ignora e la build lo scrive nel log. Fermare la build sarebbe peggio, perché il
 * titolare la bloccherebbe dallo Studio (lì la regola è solo un avviso, vedi `studio/core/src/page.ts`).
 */
export function withLegalPages(
	sitePages: readonly ResolvedPage[],
	config: Pick<SiteConfig, "languages" | "defaultLanguage">,
): ResolvedPage[] {
	const kept = sitePages.filter((page) => !isLegalSlug(page.slug));
	for (const page of sitePages) {
		if (isLegalSlug(page.slug)) {
			console.warn(
				`[legale] la pagina dello Studio "${page.slug}" (${page.language}) è ignorata: lo slug è riservato a una pagina legale del core.`,
			);
		}
	}
	const legal = config.languages.flatMap((language) =>
		LEGAL_SLUGS.map((slug) => ({
			id: `legal-${slug}`,
			slug,
			language,
			path: pagePath(language, slug, config),
			title: LEGAL_LABELS[language].pages[slug].title,
			description: LEGAL_LABELS[language].pages[slug].description,
		})),
	);
	return [...kept, ...legal];
}
