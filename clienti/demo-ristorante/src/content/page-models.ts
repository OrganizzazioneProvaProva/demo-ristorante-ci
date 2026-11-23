import type { Language } from "@siti/config";
import { resolveLocalImage } from "@siti/core/content/images.ts";
import { LEGAL_SLUGS, type LegalSlug } from "@siti/core/content/legal.ts";
import { localDateTime } from "@siti/core/content/opening-status.ts";
import {
	BOOKING_FORM_ID,
	BOOKING_REQUEST_INTRO,
} from "@siti/preset-ristorante/booking";
import { restaurantJsonLd } from "@siti/preset-ristorante/json-ld";
import { MENU_NAV_ENTRY } from "@siti/preset-ristorante/labels";
import hero from "../assets/placeholders/hero.svg";
import { fontVariables, motion } from "../design.ts";
import { MAP_QUERY } from "./company.ts";
import { bookingFor, bookingFormFor } from "./contacts.ts";
import { faqFor, testimonialsFor } from "./extras.ts";
import { config, homeFor, pageFor, pagePath } from "./home.ts";
import { hours } from "./hours.ts";
import { menuFor } from "./menu.ts";
import { galleryFor, offersFor } from "./offers.ts";
import { shellFor } from "./shell.ts";

function layoutFor({ page, alternates }: ReturnType<typeof pageFor>) {
	const { language } = page;
	const { heroActions, ...shell } = shellFor(language, page.slug);
	const { notices, promotions } = offersFor(language);
	return {
		layout: {
			...shell,
			language,
			indexing: config.indexing,
			title: page.title,
			description: page.description,
			alternates,
			fontVariables,
			motion,
			notices,
		},
		heroActions,
		promotions,
	};
}

export function homePageFor(language: Language, site?: URL) {
	const { home, ...page } = homeFor(language);
	const { layout, heroActions, promotions } = layoutFor(page);
	const image = resolveLocalImage(
		{
			src: hero,
			placeholder: true,
			alt: { it: "Foto 1 di Azienda X", en: "Photo 1 of Azienda X" },
		},
		language,
		config,
	);
	const bookingHref = bookingFor(language).href;
	const jsonLd = restaurantJsonLd({
		company: layout.company,
		url: new URL(layout.homeHref, site).href,
		idUrl: new URL(pagePath(config.defaultLanguage, "home", config), site).href,
		hours,
		today: localDateTime(new Date()).date,
		geo: MAP_QUERY,
		cuisine: menuFor(language).cuisine,
		menuUrl: new URL(pagePath(language, MENU_NAV_ENTRY.slug, config), site)
			.href,
		...(bookingHref ? { bookingUrl: new URL(bookingHref, site).href } : {}),
	});
	return {
		layout: { ...layout, jsonLd: [jsonLd] },
		home: { ...home, hero: { ...home.hero, image } },
		heroActions,
		promotions,
		images: galleryFor(language),
		hours,
		testimonials: testimonialsFor(language),
		faq: faqFor(language),
	};
}

export function aboutPageFor(language: Language) {
	const { layout } = layoutFor(pageFor("chi-siamo", language));
	return {
		layout,
		story: homeFor(language).home.story,
		hours,
		mapQuery: MAP_QUERY,
	};
}

export function galleryPageFor(language: Language) {
	const { layout } = layoutFor(pageFor("galleria", language));
	return { layout, images: galleryFor(language) };
}

export function contactPageFor(language: Language) {
	const { layout } = layoutFor(pageFor("contatti", language));
	const booking = bookingFor(language);
	const withBooking = booking.form === "booking";
	const intro = withBooking
		? BOOKING_REQUEST_INTRO[language]
		: language === "it"
			? "Scrivici: ti risponderemo il prima possibile."
			: "Write to us: we will reply as soon as we can.";
	return {
		layout,
		intro,
		formId: withBooking ? BOOKING_FORM_ID : "contatti",
		form: bookingFormFor(language, booking),
		mapQuery: MAP_QUERY,
	};
}

export function legalPageFor(slug: LegalSlug, language: Language) {
	const { layout } = layoutFor(pageFor(slug, language));
	return {
		layout,
		slug,
		config,
		features: {
			form: true,
			bookingForm: bookingFor(language).form === "booking",
			testimonials: testimonialsFor(language).length > 0,
			thirdParties: layout.contactLinks.length > 0,
			mapLink: true,
			prices: true,
			links: Object.fromEntries(
				LEGAL_SLUGS.map((legalSlug, index) => [
					legalSlug,
					layout.legalLinks[index]?.href,
				]),
			),
		},
	};
}

export function menuPageFor(language: Language) {
	const { layout } = layoutFor(pageFor(MENU_NAV_ENTRY.slug, language));
	return { layout, groups: menuFor(language).groups };
}

export function notFoundPageFor(language: Language) {
	const { heroActions: _heroActions, ...shell } = shellFor(language, "404");
	return {
		layout: { ...shell, language, actions: [], fontVariables, motion },
		contactsHref: pagePath(language, "contatti", config),
	};
}
