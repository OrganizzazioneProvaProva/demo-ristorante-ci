import type { Language, SiteConfig } from "@siti/config";
import type { ImageMetadata } from "astro";
import type { CompanyInfo } from "./company.ts";
import { contactLinks } from "./contact-links.ts";
import type { RawContacts } from "./contacts.ts";
import { legalLinks } from "./legal.ts";
import { isSiteLink } from "./links.ts";
import { resolveLogo } from "./logo.ts";
import { HOME_SLUG, pagePath } from "./pages.ts";

/**
 * Dati del "guscio" del sito (navigazione, barra di azioni, piè di pagina). I testi fissi
 * dell'interfaccia stanno qui, in tutte le lingue del core (IT+EN): una lingua senza una
 * voce non compila (nessun ripiego).
 */
export interface ShellLabels {
	call: string;
	book: string;
	map: string;
	openMap: string;
	menu: string;
	closeMenu: string;
	toTop: string;
	skipToContent: string;
	navigation: string;
	quickActions: string;
	socialProof: {
		on: string;
		reviewOne: string;
		reviewMany: string;
		read: string;
	};
	footer: {
		vatNumber: string;
		reaNumber: string;
		shareCapital: string;
		phone: string;
		email: string;
		pages: string;
		contact: string;
		follow: string;
	};
}

export const SHELL_LABELS: Record<Language, ShellLabels> = {
	it: {
		call: "Chiama",
		book: "Prenota",
		map: "Mappa",
		openMap: "Apri la mappa",
		menu: "Menu",
		closeMenu: "Chiudi",
		toTop: "Torna all'inizio della pagina",
		skipToContent: "Vai al contenuto",
		navigation: "Navigazione principale",
		quickActions: "Azioni rapide",
		socialProof: {
			on: "su",
			reviewOne: "recensione",
			reviewMany: "recensioni",
			read: "Leggi le recensioni",
		},
		footer: {
			vatNumber: "Partita IVA",
			reaNumber: "REA",
			shareCapital: "Capitale sociale",
			phone: "Telefono",
			email: "Email",
			pages: "Pagine",
			contact: "Contatti",
			follow: "Seguici",
		},
	},
	en: {
		call: "Call",
		book: "Book",
		map: "Map",
		openMap: "Open the map",
		menu: "Menu",
		closeMenu: "Close",
		toTop: "Back to top",
		skipToContent: "Skip to content",
		navigation: "Main navigation",
		quickActions: "Quick actions",
		socialProof: {
			on: "on",
			reviewOne: "review",
			reviewMany: "reviews",
			read: "Read the reviews",
		},
		footer: {
			vatNumber: "VAT number",
			reaNumber: "REA number",
			shareCapital: "Share capital",
			phone: "Phone",
			email: "Email",
			pages: "Pages",
			contact: "Contact",
			follow: "Follow us",
		},
	},
};

export interface ShellAction {
	label: string;
	href: string;
	/** Il pulsante pieno della barra in basso. Se nessuna azione lo dichiara, lo è la prima. */
	primary?: boolean;
}

export interface NavItem {
	label: string;
	href: string;
	/** Pagina corrente: scrive `aria-current="page"`. */
	current?: boolean;
}

export interface NavigationEntry {
	slug: string;
	label: Record<Language, string>;
}

export function resolveSiteShell(options: {
	config: Pick<SiteConfig, "defaultLanguage">;
	language: Language;
	currentSlug: string;
	navigation: readonly NavigationEntry[];
	company: CompanyInfo;
	contacts?: RawContacts;
	localLogo?: ImageMetadata;
	mapQuery?: string;
}) {
	const {
		config,
		language,
		currentSlug,
		navigation,
		company,
		contacts,
		localLogo,
		mapQuery,
	} = options;
	const heroActions = contactActions(company, language, { mapQuery });
	const call = heroActions.find((action) => action.href.startsWith("tel:"));
	const map = heroActions.find((action) => !action.href.startsWith("tel:"));
	return {
		company,
		homeHref: pagePath(language, HOME_SLUG, config),
		nav: navigation.map(({ label, slug }) => ({
			label: label[language],
			href: pagePath(language, slug, config),
			current: slug === currentSlug,
		})),
		actions: [
			...(map ? [map] : []),
			...(call ? [{ ...call, primary: true }] : []),
		],
		heroActions,
		legalLinks: legalLinks(language, config),
		contactLinks: contactLinks(contacts, language),
		logo: resolveLogo({
			studio: company.logo,
			local: localLogo,
			name: company.name,
			language,
			config,
		}),
	};
}

/**
 * Link `tel:` da un numero scritto come capita (`+39 0935 000000`, `0935-000.000`).
 * `undefined` se il numero non è plausibile (cifre e `+` iniziale, da 6 a 15 cifre): così
 * un campo sbagliato non produce un link che fa altro.
 */
export function telHref(phone: string): string | undefined {
	const compact = phone.replace(/[\s().-]/g, "");
	return /^\+?\d{6,15}$/.test(compact) ? `tel:${compact}` : undefined;
}

const COORDINATES = /^-?\d{1,3}(?:\.\d+)?,\s*-?\d{1,3}(?:\.\d+)?$/;

/**
 * Link a Google Maps (formato documentato in "Maps URLs": ricerca con `api=1` e `query`).
 * Solo un link: nessuna mappa incorporata, nessuna richiesta a terzi prima del clic (02).
 * `mapQuery` può essere una coppia `lat,lng` (un punto preciso); senza, si usa l'indirizzo.
 */
export function mapHref(
	company: Pick<CompanyInfo, "address">,
	mapQuery?: string,
): string {
	if (mapQuery !== undefined && !COORDINATES.test(mapQuery)) {
		throw new Error(
			`mapQuery non valida (serve "lat,lng", per esempio "37.38,14.37"): ${mapQuery}. La build si ferma.`,
		);
	}
	const { street, postalCode, city, province } = company.address;
	const query =
		mapQuery?.replace(/\s/g, "") ??
		`${street}, ${postalCode} ${city} ${province}`;
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Azioni di contatto valide per ogni nicchia, nell'ordine della barra: "Prenota" (solo se c'è
 * un modulo di prenotazione, `bookingUrl` https o percorso del sito: diventa il pulsante pieno), "Chiama" (solo se
 * c'è un telefono valido) e "Mappa". Le altre azioni di nicchia (menu, ordina) le aggiunge il
 * preset o il sito.
 */
export function contactActions(
	company: Pick<CompanyInfo, "phone" | "address">,
	language: Language,
	options: { mapQuery?: string; bookingUrl?: string } = {},
): ShellAction[] {
	const labels = SHELL_LABELS[language];
	const actions: ShellAction[] = [];
	if (options.bookingUrl !== undefined) {
		if (!isSiteLink(options.bookingUrl)) {
			throw new Error(
				`bookingUrl non valido (serve un indirizzo https o un percorso del sito): ${options.bookingUrl}. La build si ferma.`,
			);
		}
		actions.push({ label: labels.book, href: options.bookingUrl });
	}
	const tel = company.phone ? telHref(company.phone) : undefined;
	if (tel) actions.push({ label: labels.call, href: tel });
	actions.push({ label: labels.map, href: mapHref(company, options.mapQuery) });
	return actions;
}

/** Testi della valutazione pubblica nella lingua: "4,7 su Google · 120 recensioni". */
export function socialProofText(
	proof: { rating: number; reviewCount?: number | null; sourceName: string },
	language: Language,
): { summary: string; link: string } {
	const labels = SHELL_LABELS[language].socialProof;
	const locale = language === "it" ? "it-IT" : "en-GB";
	const rating = proof.rating.toLocaleString(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	const parts = [`${rating} ${labels.on} ${proof.sourceName}`];
	if (proof.reviewCount) {
		const noun = proof.reviewCount === 1 ? labels.reviewOne : labels.reviewMany;
		parts.push(`${proof.reviewCount.toLocaleString(locale)} ${noun}`);
	}
	return { summary: parts.join(" · "), link: labels.read };
}
