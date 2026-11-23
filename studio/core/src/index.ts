import { definePlugin } from "sanity";
import { companyInfoType } from "./company-info.ts";
import { type ContactsOptions, contactsType } from "./contacts.ts";
import { faqItemType, faqType } from "./faq.ts";
import { homeType } from "./home.ts";
import {
	altTextType,
	type LocaleOptions,
	localeStringRequiredType,
	localeStringType,
	localeTextRequiredType,
	localeTextType,
} from "./locale.ts";
import {
	closurePeriodType,
	openingDayType,
	openingHoursType,
	timeIntervalType,
} from "./opening-hours.ts";
import { pageType } from "./page.ts";
import { galleryType, noticeType, promotionType } from "./sections.ts";
import { siteImageType } from "./site-image.ts";
import { testimonialType } from "./testimonial.ts";

export type { ContactsOptions } from "./contacts.ts";
export type { LocaleOptions } from "./locale.ts";
export { orderedLanguages } from "./locale.ts";
export { PUBLIC_UPLOAD_NOTICE, siteImageType } from "./site-image.ts";
export {
	CORE_SINGLETON_TYPES,
	singletonDocumentConfig,
	singletonItem,
} from "./structure.ts";

/**
 * Plugin Studio del core (livello 1 dei tre di 02, "Schemi del CMS"): i tipi comuni.
 * Si usa nello Studio di ogni cliente con le lingue di site.config.ts:
 *
 *   sitiStudioCore({ languages: config.languages, defaultLanguage: config.defaultLanguage })
 */
/** Opzioni del plugin: lingue e moduli di `site.config.ts` (già validato da @siti/config). */
export type CoreOptions = LocaleOptions & ContactsOptions;

export const sitiStudioCore = definePlugin<CoreOptions>((options) => ({
	name: "siti-studio-core",
	schema: {
		types: [
			localeStringType(options),
			localeTextType(options),
			localeStringRequiredType(options),
			localeTextRequiredType(options),
			altTextType(options),
			siteImageType,
			timeIntervalType,
			openingDayType,
			closurePeriodType,
			companyInfoType,
			openingHoursType,
			galleryType,
			contactsType(options),
			faqItemType,
			faqType,
			testimonialType,
			homeType(options),
			promotionType(options),
			noticeType(options),
			pageType(options),
		],
	},
}));
