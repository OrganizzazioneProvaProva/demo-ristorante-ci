import { z } from "zod";
import { isAllowedHostName } from "./content-links.ts";

/**
 * Lingue che il core sa gestire. Aggiungerne una è un'aggiunta: si estende questo elenco
 * e ogni sito la attiva da site.config.ts (regola "prima le aggiunte", 02 "Rilasci del core").
 */
export const SUPPORTED_LANGUAGES = ["it", "en"] as const;

export const languageSchema = z.enum(SUPPORTED_LANGUAGES);
export type Language = z.infer<typeof languageSchema>;

/**
 * Modulo prenotazioni (02, "Pacchetti e moduli"; 01: richiesta sul sito, Cal.com, TheFork e simili):
 * - `none`: il sito non ha prenotazioni (niente «Prenota», niente `acceptsReservations`, il form dei contatti usa i campi base);
 * - `request`: modulo di richiesta sul sito (predefinito); un link esterno nello Studio ha la precedenza sul pulsante «Prenota»;
 * - `external`: solo una piattaforma esterna (TheFork, Cal.com…): serve il link nello Studio, altrimenti la build si ferma.
 */
export const BOOKING_MODES = ["none", "request", "external"] as const;
export type BookingMode = (typeof BOOKING_MODES)[number];

/** Tipo di sito: `demo` è un sito di prova o dimostrativo (ammette segnaposto e dati finti), `site` un sito vero. */
export const SITE_KINDS = ["site", "demo"] as const;
export type SiteKind = (typeof SITE_KINDS)[number];

export const INDEXING_MODES = ["allow", "block"] as const;
export type IndexingMode = (typeof INDEXING_MODES)[number];

/** Nomi di cartella dei siti di prova e dimostrativi: ammessi come `demo` e solo come `demo`. */
export const DEMO_SLUGS = /^(?:prova|demo-.+)$/;

/**
 * Vero solo se il sito dichiara `kind: "demo"` E il suo slug è quello di un sito di prova o demo
 * (`prova`, `demo-*`). Servono entrambi: un cliente vero chiamato `demo-qualcosa` senza `kind` resta
 * un sito vero, e un sito che si dichiara `demo` con uno slug da cliente è un errore.
 */
export function allowsPlaceholders(site: {
	slug: string;
	kind?: SiteKind;
}): boolean {
	return (site.kind ?? "site") === "demo" && DEMO_SLUGS.test(site.slug);
}

const endpointBase = new URL("https://endpoint-base.invalid");
const ambiguousUrlCharacters = /[\s\p{Cc}\\]/u;

/** Percorso dalla radice del sito, senza caratteri che il browser può reinterpretare. */
export function isLocalSitePath(value: string): boolean {
	return (
		value.startsWith("/") &&
		!value.startsWith("//") &&
		!ambiguousUrlCharacters.test(value)
	);
}

export function parseFormEndpoint(value: string) {
	if (value.includes("#")) return undefined;
	const local = isLocalSitePath(value);
	if (!local) {
		if (ambiguousUrlCharacters.test(value)) return undefined;
		const authority = /^https:\/\/([^/?]+)/i.exec(value)?.[1];
		if (!authority || authority.includes("@") || authority.endsWith(":"))
			return undefined;
	}
	let url: URL;
	try {
		url = new URL(value, endpointBase);
	} catch {
		return undefined;
	}
	if (url.protocol !== "https:" || url.username || url.password)
		return undefined;
	if (!local)
		return { href: url.href, origin: url.origin, hostname: url.hostname };
	const href = url.href.slice(endpointBase.origin.length);
	if (
		url.origin !== endpointBase.origin ||
		!href.startsWith("/") ||
		href.startsWith("//")
	)
		return undefined;
	return { href };
}

const endpointSchema = z.string().transform((value, ctx) => {
	const endpoint = parseFormEndpoint(value);
	if (endpoint) return endpoint.href;
	ctx.addIssue({
		code: "custom",
		message:
			"serve un indirizzo https oppure un percorso del sito (per esempio /api/richiesta)",
	});
	return z.NEVER;
});

/** Antispam dei moduli (02: Turnstile invisibile; ALTCHA nella stessa interfaccia, da aggiungere). */
export const ANTISPAM_MODES = ["none", "turnstile"] as const;
export type AntispamMode = (typeof ANTISPAM_MODES)[number];

/** Statistiche senza cookie (02): Cloudflare Web Analytics, che la zona inietta da sola. */
export const ANALYTICS_MODES = ["none", "cloudflare"] as const;
export type AnalyticsMode = (typeof ANALYTICS_MODES)[number];

// https://developers.cloudflare.com/turnstile/troubleshooting/testing/#test-sitekeys
const testSiteKeys = new Set([
	"1x00000000000000000000AA",
	"2x00000000000000000000AB",
	"1x00000000000000000000BB",
	"2x00000000000000000000BB",
	"3x00000000000000000000FF",
]);

/**
 * Contenuto di site.config.ts di un sito cliente. Per ora solo ciò che serve a lingue e
 * schemi; pacchetto, moduli e stato del piano si aggiungono in seguito (campi facoltativi).
 * Il file site.config.ts resta di soli dati: nessun import a runtime, perché lo leggono
 * sia il sito Astro sia lo Studio di Sanity.
 */
export const siteConfigSchema = z
	.strictObject({
		/** Come il nome della cartella e dell'ambiente di CI: `^[a-z0-9-]+$` (04 §2). */
		slug: z.string().regex(/^[a-z0-9-]+$/, "solo minuscole, cifre e trattini"),
		/** Versione degli schemi del CMS su cui il sito è allineato (02, "Rilasci del core"). */
		schemaVersion: z.number().int().positive(),
		/** L'italiano è la lingua principale: clienti italiani. */
		defaultLanguage: languageSchema.default("it"),
		/** Lingue attive del sito. Un cliente senza il modulo lingua ha solo ["it"]. */
		languages: z.array(languageSchema).min(1).default(["it"]),
		/** `demo` per i siti di prova e dimostrativi (con lo slug giusto); predefinito `site`. */
		kind: z.enum(SITE_KINDS).default("site"),
		indexing: z.enum(INDEXING_MODES).optional(),
		/** Host ammessi per le destinazioni https dei contenuti, compresi i sottodomini. */
		links: z
			.strictObject({
				allowedHosts: z.array(
					z
						.string()
						.refine(isAllowedHostName, "serve un nome host DNS in minuscolo"),
				),
			})
			.optional(),
		/** Moduli attivi (02): facoltativo, ogni modulo ha un valore predefinito. */
		modules: z
			.strictObject({
				booking: z.enum(BOOKING_MODES).optional(),
				forms: z
					.strictObject({
						/** Dove va il POST del modulo (il Worker dei moduli). Senza, il sito non può avere moduli veri. */
						endpoint: endpointSchema.optional(),
						/** Chiave pubblica del widget Turnstile (la chiave segreta sta nel Worker, mai qui). */
						turnstileSiteKey: z
							.string()
							.regex(/^[0-9A-Za-z_-]{10,64}$/, "chiave pubblica di Turnstile")
							.optional(),
					})
					.optional(),
				antispam: z.enum(ANTISPAM_MODES).optional(),
				analytics: z.enum(ANALYTICS_MODES).optional(),
			})
			.optional(),
	})
	.superRefine((config, ctx) => {
		if (config.kind === "demo" && config.indexing === "allow") {
			ctx.addIssue({
				code: "custom",
				path: ["indexing"],
				message: "un sito demo deve avere indexing: block",
			});
		}
		const siteKey = config.modules?.forms?.turnstileSiteKey;
		if (config.modules?.antispam === "turnstile" && !siteKey) {
			ctx.addIssue({
				code: "custom",
				path: ["modules", "forms", "turnstileSiteKey"],
				message: "con antispam: turnstile serve la chiave pubblica del widget",
			});
		}
		if (siteKey && testSiteKeys.has(siteKey) && !allowsPlaceholders(config)) {
			ctx.addIssue({
				code: "custom",
				path: ["modules", "forms", "turnstileSiteKey"],
				message:
					"le chiavi pubbliche di test Turnstile sono riservate ai siti demo",
			});
		}
		if (config.kind === "demo" && !DEMO_SLUGS.test(config.slug)) {
			ctx.addIssue({
				code: "custom",
				path: ["kind"],
				message: `kind: "demo" è ammesso solo per gli slug prova e demo-* (questo è "${config.slug}")`,
			});
		}
		if (new Set(config.languages).size !== config.languages.length) {
			ctx.addIssue({
				code: "custom",
				path: ["languages"],
				message: "lingue duplicate",
			});
		}
		if (!config.languages.includes(config.defaultLanguage)) {
			ctx.addIssue({
				code: "custom",
				path: ["defaultLanguage"],
				message: "la lingua principale deve essere tra le lingue attive",
			});
		}
	})
	.transform((config) => ({
		...config,
		indexing: config.indexing ?? (config.kind === "demo" ? "block" : "allow"),
	}));

/** Ciò che si scrive in site.config.ts (i valori predefiniti sono facoltativi). */
export type SiteConfigInput = z.input<typeof siteConfigSchema>;
/** Configurazione validata, con i valori predefiniti applicati. */
export type SiteConfig = z.output<typeof siteConfigSchema>;

export function parseSiteConfig(input: unknown): SiteConfig {
	return siteConfigSchema.parse(input);
}

/** Vero se il sito ha più di una lingua attiva. */
export function isMultilingual(config: SiteConfig): boolean {
	return config.languages.length > 1;
}

/** Modalità di prenotazione del sito: `request` se il modulo non è indicato. */
export function bookingMode(config: Pick<SiteConfig, "modules">): BookingMode {
	return config.modules?.booking ?? "request";
}

/** Modalità antispam dei moduli: `none` se non è indicata. */
export function antispamMode(
	config: Pick<SiteConfig, "modules">,
): AntispamMode {
	return config.modules?.antispam ?? "none";
}

/** Statistiche: `none` se non sono indicate. */
export function analyticsMode(
	config: Pick<SiteConfig, "modules">,
): AnalyticsMode {
	return config.modules?.analytics ?? "none";
}
