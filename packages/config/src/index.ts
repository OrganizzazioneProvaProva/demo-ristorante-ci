export {
	type ContentLinkPolicy,
	contentHttpsHostname,
	isPromotionLink,
	requireContentHttpsLink,
	resolvePromotionLink,
} from "./content-links.ts";
export { companyEmailContact, parseCompanyEmails } from "./email.ts";
export { HOLIDAYS, type HolidayId } from "./holidays.ts";
export {
	isLegalSlug,
	LEGAL_SLUGS,
	type LegalSlug,
} from "./legal-slugs.ts";
export {
	dateRangeError,
	findOverlap,
	intervalSpan,
	isValidMonthDay,
	isValidTime,
	isValidVatNumber,
	type PathSegment,
	type TimeInterval,
	valueAtPath,
} from "./rules.ts";
export {
	ANALYTICS_MODES,
	ANTISPAM_MODES,
	type AnalyticsMode,
	type AntispamMode,
	allowsPlaceholders,
	analyticsMode,
	antispamMode,
	BOOKING_MODES,
	type BookingMode,
	bookingMode,
	DEMO_SLUGS,
	INDEXING_MODES,
	type IndexingMode,
	isLocalSitePath,
	isMultilingual,
	type Language,
	languageSchema,
	parseFormEndpoint,
	parseSiteConfig,
	SITE_KINDS,
	type SiteConfig,
	type SiteConfigInput,
	type SiteKind,
	SUPPORTED_LANGUAGES,
	siteConfigSchema,
} from "./site-config.ts";
export {
	isSocialUrl,
	SOCIAL_KINDS,
	type SocialKind,
	whatsappDigits,
	whatsappUrl,
} from "./social.ts";
