import {
	analyticsMode,
	antispamMode,
	type IndexingMode,
	parseFormEndpoint,
	type SiteConfig,
} from "@siti/config";

/**
 * Sicurezza del sito (04 §3): la CSP e le intestazioni si compongono dai moduli attivi in
 * `site.config.ts`. Funzioni pure, senza Astro: le usano `astro.config.mjs` di ogni sito (CSP
 * `security.csp` con gli hash di Astro, nel `<meta>`) e lo script dopo la build che scrive
 * `dist/_headers`.
 *
 * Si parte stretti: tutto `'self'`. Una sorgente esterna entra solo per un modulo attivo e solo con il
 * motivo scritto qui. Le immagini del cliente si scaricano e si ottimizzano alla build, quindi si
 * servono dal sito (niente `cdn.sanity.io` né `data:`).
 */

type SecurityConfig = Pick<SiteConfig, "modules">;

/** Turnstile (Cloudflare): lo script `api.js` e la finestra del widget. Unica configurazione senza nonce (documentata da Cloudflare). */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
/** Web Analytics: la zona inietta lo script e il beacon invia i dati qui. NON verificato su un account reale. */
export const ANALYTICS_SCRIPT_ORIGIN = "https://static.cloudflareinsights.com";
export const ANALYTICS_CONNECT_ORIGIN = "https://cloudflareinsights.com";

/** L'origine della destinazione del modulo se è un indirizzo assoluto; `undefined` se è del sito stesso. */
export function endpointOrigin(
	endpoint: string | undefined,
): string | undefined {
	return endpoint === undefined
		? undefined
		: parseFormEndpoint(endpoint)?.origin;
}

/** Host non reali: ammessi come destinazione del modulo solo nei siti `demo`. */
const RESERVED_HOST = /(?:^|\.)(?:invalid|example|test|localhost)$/i;

export function isReservedHost(endpoint: string): boolean {
	const hostname = parseFormEndpoint(endpoint)?.hostname;
	return (
		hostname !== undefined && RESERVED_HOST.test(hostname.replace(/\.$/, ""))
	);
}

/** Direttive oltre a `script-src` e `style-src` (queste le scrive Astro con gli hash), per `security.csp.directives`. */
export function cspDirectives(config: SecurityConfig): string[] {
	const turnstile = antispamMode(config) === "turnstile";
	const analytics = analyticsMode(config) === "cloudflare";
	const origin = endpointOrigin(config.modules?.forms?.endpoint);
	return [
		"default-src 'self'",
		"img-src 'self'",
		"font-src 'self'",
		`connect-src 'self'${analytics ? ` ${ANALYTICS_CONNECT_ORIGIN}` : ""}`,
		`form-action 'self'${origin ? ` ${origin}` : ""}`,
		`frame-src ${turnstile ? TURNSTILE_ORIGIN : "'none'"}`,
		"base-uri 'self'",
		"object-src 'none'",
	];
}

/** Sorgenti di `script-src` oltre agli hash: il sito stesso e, per i moduli attivi, i servizi di terzi (host senza apici). */
export function scriptSources(config: SecurityConfig): string[] {
	return [
		"'self'",
		...(antispamMode(config) === "turnstile" ? [TURNSTILE_ORIGIN] : []),
		...(analyticsMode(config) === "cloudflare"
			? [ANALYTICS_SCRIPT_ORIGIN]
			: []),
	];
}

/**
 * Oggetto per `security.csp` di Astro. Con `scriptDirective.resources` Astro non aggiunge più `'self'`:
 * va scritto qui. Gli host si scrivono senza apici (con gli apici il browser li ignora).
 */
export function astroCsp(config: SecurityConfig) {
	return {
		directives: cspDirectives(config),
		scriptDirective: { resources: scriptSources(config) },
	};
}

/**
 * Contenuto di `dist/_headers` (Cloudflare). Una sola regola per tutte le pagine. La CSP dell'intestazione
 * porta SOLO ciò che un `<meta>` non può dire (`frame-ancestors`) più `base-uri` e `object-src`: mai
 * `script-src`, perché l'intestazione non ha gli hash di ogni pagina e bloccherebbe gli script (le due
 * CSP valgono insieme). HSTS per un anno senza `includeSubDomains` né preload (04 §3).
 */
export function securityHeaders(indexing: IndexingMode = "allow"): string {
	return [
		"/*",
		"  Strict-Transport-Security: max-age=31536000",
		"  X-Content-Type-Options: nosniff",
		"  Referrer-Policy: strict-origin-when-cross-origin",
		"  Permissions-Policy: camera=(), microphone=(), geolocation=()",
		"  Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
		...(indexing === "block" ? ["  X-Robots-Tag: noindex"] : []),
		"",
	].join("\n");
}

/** Le intestazioni obbligatorie di `_headers`, per il controllo dopo la build. */
export const REQUIRED_HEADERS = [
	"Strict-Transport-Security",
	"X-Content-Type-Options",
	"Referrer-Policy",
	"Permissions-Policy",
	"Content-Security-Policy",
] as const;

/** Legge le intestazioni della regola `/*` di un `_headers` (nome → valore). */
export function parseHeadersFile(text: string): Record<string, string> {
	const headers: Record<string, string> = {};
	let inAll = false;
	for (const line of text.split("\n")) {
		if (line.trim() === "") continue;
		if (!/^\s/.test(line)) {
			inAll = line.trim() === "/*";
			continue;
		}
		if (!inAll) continue;
		const index = line.indexOf(":");
		if (index > 0)
			headers[line.slice(0, index).trim()] = line.slice(index + 1).trim();
	}
	return headers;
}
