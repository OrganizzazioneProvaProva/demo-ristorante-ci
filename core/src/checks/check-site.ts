import {
	allowsPlaceholders,
	analyticsMode,
	antispamMode,
	type SiteConfig,
} from "@siti/config";
import {
	HERO_MIN_CONTRAST,
	heroScrimContrast,
	MOTION_LEVELS,
} from "@siti/design";
import { parse, defaultTreeAdapter as tree } from "parse5";
import { BUTTON_BASE, BUTTON_VARIANTS } from "../button-classes.ts";
import { LEGAL_SLUGS } from "../content/legal.ts";
import { notFoundPath } from "../content/not-found.ts";
import { pagePath } from "../content/pages.ts";
import { isReservedHost } from "../content/security.ts";
import { htmlAttr, htmlNodes } from "./csp-html.ts";
import { type BuiltPage, securityProblems } from "./dist-security.ts";

/**
 * Controllo del CSS compilato di un sito (condiviso da tutti i siti, mai copiato).
 *
 * Tailwind v4 non scansiona node_modules: le classi usate SOLO dai componenti del core
 * arrivano nel CSS del sito grazie a `@source` in `theme.css`. Se questo controllo fallisce,
 * il sito perde gli stili del core. Le classi attese si leggono dal codice del core (le
 * stesse costanti dei componenti); il loro nome non deve comparire in nessun file del sito,
 * altrimenti Tailwind le troverebbe da lì e il controllo passerebbe anche senza `@source`.
 */

/**
 * Classi del pulsante pieno e delle pagine del core: devono arrivare nel CSS del sito
 * tramite `@source` in `theme.css` anche se il sito non renderizza quei componenti.
 */
export const PROBE_CLASSES = [
	...BUTTON_BASE.split(" "),
	...BUTTON_VARIANTS.primary.split(" "),
	"max-w-2xl",
	"max-w-5xl",
];

/**
 * Classe che solo il core usa: se compare in un file del sito, il controllo di `@source`
 * non è più affidabile. Non una classe generica (`inline-flex`): i siti le usano di continuo.
 */
export const SENTINEL_CLASS = "hover:bg-accent-hover";

/**
 * Classi che compaiono solo come esempi vietati nei test del core: se arrivano nel CSS di un
 * sito, `@source not` in `theme.css` non funziona e i test generano CSS in ogni sito.
 */
export const TEST_ONLY_SELECTORS = [".outline-hidden", ".ring-accent\\/50"];

/** Variabili del livello base del core, che devono avere un valore nel CSS del sito. */
export const REQUIRED_VARIABLES = [
	// con i due punti: `--t-accent` non deve essere soddisfatto da `--t-accent-hover`
	"--t-accent:",
	"--t-accent-hover:",
	"--color-accent:",
	// `@theme inline` non emette --color-accent-hover: la classe scrive direttamente il valore
	"var(--t-accent-hover)",
	"--color-bg:",
	"--font-body:",
];

/** Selettore CSS di una classe di Tailwind (`hover:bg-x` → `.hover\:bg-x`). */
export function selectorOf(className: string): string {
	return `.${className.replace(/[^A-Za-z0-9_-]/g, (char) => `\\${char}`)}`;
}

/**
 * JavaScript del sito (byte compressi con gzip, somma di tutti i moduli): oltre la soglia di
 * avviso `siteWarnings` lo segnala, oltre il tetto `checkSite` ferma la build. Il JavaScript
 * pesa sul telefono (scaricamento, lettura, esecuzione: INP e LCP); si preferisce il CSS.
 */
export const JS_WARN_GZIP_BYTES = 5 * 1024;
export const JS_BUDGET_GZIP_BYTES = 15 * 1024;

/** Avvisi che non fermano la build (per ora solo il JavaScript sopra la soglia). */
export function siteWarnings({
	jsGzipBytes,
}: Pick<SiteFiles, "jsGzipBytes">): string[] {
	return jsGzipBytes !== undefined &&
		jsGzipBytes > JS_WARN_GZIP_BYTES &&
		jsGzipBytes <= JS_BUDGET_GZIP_BYTES
		? [
				`JavaScript del sito ${jsGzipBytes} byte compressi: oltre la soglia di avviso di ${JS_WARN_GZIP_BYTES} (il tetto è ${JS_BUDGET_GZIP_BYTES})`,
			]
		: [];
}

/** Proprietà che un `@keyframes` può animare (prestazioni: niente layout né paint costosi). */
export const ANIMATABLE_PROPERTIES = new Set([
	"opacity",
	"transform",
	"translate",
	"scale",
	"rotate",
]);

/** Funzioni del movimento che devono stare solo dentro `prefers-reduced-motion: no-preference`. */
const MOTION_ONLY_PATTERNS = [
	/@view-transition/,
	/animation-timeline/,
	/view-timeline/,
	/timeline-scope/,
];

/** Toglie dal CSS i blocchi `@media` che contengono `prefers-reduced-motion: no-preference`. */
export function withoutNoPreferenceBlocks(css: string): string {
	const opener = /@media[^{]*prefers-reduced-motion:\s*no-preference[^{]*\{/g;
	let result = "";
	let cursor = 0;
	for (let match = opener.exec(css); match; match = opener.exec(css)) {
		if (match.index < cursor) continue;
		result += css.slice(cursor, match.index);
		let depth = 1;
		let index = match.index + match[0].length;
		while (index < css.length && depth > 0) {
			if (css[index] === "{") depth++;
			else if (css[index] === "}") depth--;
			index++;
		}
		cursor = index;
		opener.lastIndex = index;
	}
	return result + css.slice(cursor);
}

/** Le proprietà usate nei `@keyframes` del CSS che non sono tra quelle ammesse. */
export function forbiddenKeyframeProperties(css: string): string[] {
	const found = new Set<string>();
	const opener = /@keyframes\s+[^{]+\{/g;
	for (let match = opener.exec(css); match; match = opener.exec(css)) {
		let depth = 1;
		let index = match.index + match[0].length;
		const start = index;
		while (index < css.length && depth > 0) {
			if (css[index] === "{") depth++;
			else if (css[index] === "}") depth--;
			index++;
		}
		const body = css.slice(start, index - 1);
		for (const declaration of body.matchAll(/([a-z-]+)\s*:/g)) {
			const name = declaration[1] as string;
			if (!ANIMATABLE_PROPERTIES.has(name)) found.add(name);
		}
	}
	return [...found];
}

/**
 * I blocchi JSON-LD dell'HTML costruito: devono essere JSON valido con `@context` e `@type`, e
 * non contenere `<`, `>`, `&` né i separatori di riga Unicode (`serializeJsonLd` li esce): è il
 * solo punto con HTML grezzo (`04` §3) e un dato ostile non deve poter chiudere il tag.
 */
export function jsonLdProblems(html: string): string[] {
	const problems: string[] = [];
	const blocks = html.matchAll(
		/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g,
	);
	for (const [, content = ""] of blocks) {
		const forbidden = [
			"<",
			">",
			"&",
			String.fromCharCode(0x2028),
			String.fromCharCode(0x2029),
		].filter((character) => content.includes(character));
		if (forbidden.length > 0) {
			problems.push(
				`JSON-LD con caratteri non esclusi (${forbidden.map((c) => JSON.stringify(c)).join(", ")})`,
			);
		}
		try {
			const data = JSON.parse(content);
			if (
				typeof data?.["@context"] !== "string" ||
				typeof data?.["@type"] !== "string"
			) {
				problems.push("JSON-LD senza @context o @type");
			}
		} catch {
			problems.push("JSON-LD non è JSON valido");
		}
	}
	return problems;
}

/**
 * I livelli di movimento: il CSS ha le regole del livello espressivo e l'esclusione di quello
 * senza animazioni; ogni pagina ha `<html data-motion>` con un livello valido, uguale in tutto
 * il sito; il cambio di pagina nativo (`@view-transition`) c'è se e solo se il livello non è
 * `no-animation`.
 */
export function motionLevelProblems(css: string, html: string[]): string[] {
	const problems: string[] = [];
	if (!/\[data-motion=["']?expressive-animation["']?\]/.test(css)) {
		problems.push(
			"manca il livello espressivo ([data-motion=expressive-animation]) nel CSS",
		);
	}
	if (!/:not\(\[data-motion=["']?no-animation["']?\]\)/.test(css)) {
		problems.push(
			"manca l'esclusione del livello no-animation (:not([data-motion=no-animation])) nel CSS",
		);
	}
	if (html.length === 0) return problems;

	const levels = html.map(
		(page) => /<html\b[^>]*\sdata-motion="([^"]*)"/.exec(page)?.[1],
	);
	if (levels.some((level) => level === undefined)) {
		problems.push("una pagina non ha <html data-motion>");
		return problems;
	}
	const invalid = levels.filter(
		(level) =>
			level === undefined ||
			!(MOTION_LEVELS as readonly string[]).includes(level),
	);
	if (invalid.length > 0) {
		problems.push(
			`data-motion non valido: ${[...new Set(invalid)].join(", ")} (ammessi: ${MOTION_LEVELS.join(", ")})`,
		);
		return problems;
	}
	const distinct = [...new Set(levels)];
	if (distinct.length > 1) {
		problems.push(
			`le pagine hanno livelli di movimento diversi (${distinct.join(", ")}): il livello è uno per sito`,
		);
		return problems;
	}
	const hasPageTransition = /@view-transition/.test(css);
	if (distinct[0] === "no-animation" && hasPageTransition) {
		problems.push(
			"livello no-animation ma il CSS contiene @view-transition (cambio di pagina animato)",
		);
	}
	if (distinct[0] !== "no-animation" && !hasPageTransition) {
		problems.push(
			`livello ${distinct[0]} ma il CSS non contiene @view-transition`,
		);
	}
	return problems;
}

export interface SiteFiles {
	css: string;
	/** Testo dei file sorgente del sito (pagine, componenti): senza CSS generato. */
	sources: string[];
	pages?: BuiltPage[];
	config?: SiteConfig;
	/**
	 * Contenuto di `dist/_headers`; `null` se il file non c'è (è un errore). Se la voce manca del
	 * tutto, i controlli di sicurezza (CSP, `style=`, `_headers`) si saltano: serve ai test unitari.
	 */
	headersFile?: string | null;
	robotsFile?: string | null;
	/** JavaScript del sito compresso (somma dei moduli), per il tetto. */
	jsGzipBytes?: number;
	/** Classi "sonda" di altri pacchetti (per esempio il preset), da trovare nel CSS del sito. */
	extraProbeClasses?: string[];
}

/** Il banco di prova dei componenti del core: ha pagine nude senza piè di pagina (vedi `contentProblems`). */
export const LEGAL_FOOTER_EXEMPT_SITES = /^prova$/;

const titleOf = (page: string) =>
	/<title>([^<]*)<\/title>/.exec(page)?.[1]?.trim() ?? "";
const descriptionOf = (page: string) =>
	/<meta\s+name="description"\s+content="([^"]*)"/.exec(page)?.[1]?.trim() ??
	"";
const languageOf = (page: string) =>
	/<html[^>]*\slang="([^"]*)"/.exec(page)?.[1] ?? "";

export function notFoundProblems(
	pages: readonly BuiltPage[],
	config: Pick<SiteConfig, "languages" | "defaultLanguage">,
): string[] {
	return config.languages.flatMap((language) => {
		const path = notFoundPath(language, config).slice(1);
		const page = pages.find((page) => page.path === path);
		if (!page) return [`${path}: pagina 404 mancante`];
		if (languageOf(page.html) !== language)
			return [`${path}: lingua della pagina 404 diversa da ${language}`];
		return [];
	});
}

/**
 * Controlli sul contenuto delle pagine costruite (02: conformità; build bloccata se mancano):
 * - title e description presenti e unici in ogni lingua;
 * - il piè di pagina porta i link a tutte le pagine legali (il banco di prova `prova` è escluso,
 *   perché ha pagine nude di prova dei componenti: l'esenzione è esplicita, qui sopra);
 * - nessun segnaposto legale (`data-legal-placeholder`) in un sito vero: il testo legale lo
 *   scrive o lo rivede il legale prima della pubblicazione.
 */
export function contentProblems(
	html: readonly string[],
	slug: string,
	placeholders: boolean,
): string[] {
	const problems: string[] = [];
	const seen = new Map<string, number>();
	let missingTitle = 0;
	let missingDescription = 0;
	let missingLegalLinks = 0;
	for (const page of html) {
		const title = titleOf(page);
		const description = descriptionOf(page);
		if (!title) missingTitle++;
		if (!description) missingDescription++;
		for (const [kind, value] of [
			["title", title],
			["description", description],
		] as const) {
			if (!value) continue;
			const key = `${kind}|${languageOf(page)}|${value}`;
			seen.set(key, (seen.get(key) ?? 0) + 1);
		}
		if (!LEGAL_FOOTER_EXEMPT_SITES.test(slug)) {
			const nav = /<nav[^>]*data-legal-links[^>]*>([\s\S]*?)<\/nav>/.exec(page);
			const links = nav ? (nav[1]?.match(/<a\s/g) ?? []).length : 0;
			if (links < LEGAL_SLUGS.length) missingLegalLinks++;
		}
	}
	if (missingTitle > 0) {
		problems.push(`${missingTitle} pagine senza <title>`);
	}
	if (missingDescription > 0) {
		problems.push(`${missingDescription} pagine senza meta description`);
	}
	const duplicated = [...seen].filter(([, count]) => count > 1);
	for (const [key] of duplicated) {
		const [kind, language, value] = key.split("|");
		problems.push(
			`${kind} duplicato in ${language || "?"}: "${value}" (ogni pagina ha il suo)`,
		);
	}
	if (missingLegalLinks > 0) {
		problems.push(
			`${missingLegalLinks} pagine senza i link alle pagine legali nel piè di pagina (privacy, cookie, note legali, accessibilità)`,
		);
	}
	if (
		!placeholders &&
		html.some((page) => /\sdata-legal-placeholder\b/.test(page))
	) {
		problems.push(
			`il sito "${slug}" ha testi legali segnaposto (data-legal-placeholder): servono i testi rivisti dal legale`,
		);
	}
	return problems;
}

export function cookieNoticeProblems(
	pages: readonly BuiltPage[],
	config: SiteConfig,
): string[] {
	const expected: string[] = [];
	if (antispamMode(config) === "turnstile") expected.push("turnstile");
	if (analyticsMode(config) === "cloudflare") expected.push("analytics");
	if (expected.length === 0) expected.push("none");

	const byPath = new Map(pages.map(({ path, html }) => [path, html]));
	return config.languages.flatMap((language) => {
		const path = `${pagePath(language, "cookie", config).slice(1)}index.html`;
		const html = byPath.get(path);
		if (html === undefined)
			return [`${path}: informativa cookie mancante per ${language}`];

		const elements = [...htmlNodes(parse(html), false)].filter(
			tree.isElementNode,
		);
		const root = elements.find((node) => node.tagName === "html");
		if (!root || htmlAttr(root, "lang") !== language) {
			return [
				`${path}: informativa cookie nella lingua sbagliata (attesa ${language})`,
			];
		}
		const main = elements.find((node) => node.tagName === "main");
		const actual = main
			? [...htmlNodes(main, false)]
					.filter(tree.isElementNode)
					.flatMap((node) => {
						if (
							node.tagName !== "p" ||
							htmlAttr(node, "hidden") !== undefined ||
							!node.childNodes.some(
								(child) => tree.isTextNode(child) && child.value.trim(),
							)
						)
							return [];
						const marker = htmlAttr(node, "data-cookie-tool");
						return marker === undefined ? [] : [marker];
					})
			: [];
		return actual.length === expected.length &&
			expected.every((tool) => actual.includes(tool))
			? []
			: [
					`${path}: informativa cookie incoerente con la configurazione (blocchi attesi: ${expected.join(", ")})`,
				];
	});
}

/**
 * Hero a tutto schermo (`data-hero-cover`): il titolo (colore `bg`) sul velo scuro (`ink`) deve
 * restare leggibile su qualunque foto, quindi si controlla il contrasto nel caso peggiore (foto
 * bianca o nera). I colori si leggono dal CSS compilato del sito. Solo dove l'hero c'è.
 */
export function heroCoverProblems(
	css: string,
	html: readonly string[],
): string[] {
	if (!html.some((page) => page.includes("data-hero-cover"))) return [];
	const color = (name: string) =>
		new RegExp(`--t-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1];
	const ink = color("ink");
	const bg = color("bg");
	if (!ink || !bg) {
		return [
			"hero a tutto schermo: nel CSS mancano --t-ink e --t-bg per verificare il contrasto del titolo",
		];
	}
	const { worst } = heroScrimContrast({ ink, bg });
	return worst >= HERO_MIN_CONTRAST
		? []
		: [
				`hero a tutto schermo: il titolo sul velo ha contrasto ${worst.toFixed(2)}:1 nel caso peggiore (foto bianca o nera), servono ${HERO_MIN_CONTRAST}:1`,
			];
}

/** Gli `action` dei `<form>` di una pagina. */
export function formActions(page: string): string[] {
	return [...page.matchAll(/<form\b[^>]*\saction="([^"]*)"/g)].map(
		(match) => match[1] ?? "",
	);
}

export function checkSite({
	css,
	sources,
	pages = [],
	config,
	headersFile,
	robotsFile,
	jsGzipBytes,
	extraProbeClasses = [],
}: SiteFiles): string[] {
	const problems: string[] = [];
	// Solo un sito dichiarato `demo` (con slug `prova` o `demo-*`) può avere segnaposto (config).
	const slug = config?.slug;
	const html = pages.map((page) => page.html);
	const placeholders = config !== undefined && allowsPlaceholders(config);
	if (css.length === 0) return ["il sito non ha CSS compilato"];

	const missing = [
		...[...PROBE_CLASSES, ...extraProbeClasses].map(selectorOf),
		...REQUIRED_VARIABLES,
	].filter((needle) => !css.includes(needle));
	if (missing.length > 0) {
		problems.push(`nel CSS compilato mancano: ${missing.join(", ")}`);
	}

	const leaked = TEST_ONLY_SELECTORS.filter((needle) => css.includes(needle));
	if (leaked.length > 0) {
		problems.push(
			`il CSS contiene classi dei test del core (${leaked.join(", ")}): @source not non funziona`,
		);
	}

	if (!/@media[^{]*hover:\s*hover[^{]*pointer:\s*fine/.test(css)) {
		problems.push(
			"l'hover non è limitato a (hover: hover) and (pointer: fine) (core/DESIGN.md)",
		);
	}

	if (!/@media[^{]*prefers-reduced-motion:\s*reduce/.test(css)) {
		problems.push("manca la regola di prefers-reduced-motion");
	}
	if (/prefers-color-scheme/.test(css)) {
		problems.push("il CSS segue prefers-color-scheme (nessuna modalità scura)");
	}

	const sentinel = SENTINEL_CLASS;
	if (sources.some((source) => source.includes(sentinel))) {
		problems.push(
			`un file del sito contiene classi del core (${sentinel}): il controllo di @source non sarebbe affidabile`,
		);
	}

	const outside = withoutNoPreferenceBlocks(css);
	const motionLeaks = MOTION_ONLY_PATTERNS.filter((pattern) =>
		pattern.test(outside),
	);
	if (motionLeaks.length > 0) {
		problems.push(
			`movimento fuori da prefers-reduced-motion: no-preference (${motionLeaks.map(String).join(", ")})`,
		);
	}
	if (/transition(?:-property)?:\s*all\b/.test(css)) {
		problems.push(
			"`transition: all` è vietato (si animano solo proprietà precise)",
		);
	}
	const badKeyframes = forbiddenKeyframeProperties(css);
	if (badKeyframes.length > 0) {
		problems.push(
			`i @keyframes animano proprietà non ammesse: ${badKeyframes.join(", ")} (solo opacity, transform, translate, scale, rotate)`,
		);
	}

	problems.push(...motionLevelProblems(css, html));
	problems.push(...new Set(html.flatMap((page) => jsonLdProblems(page))));

	if (jsGzipBytes !== undefined && jsGzipBytes > JS_BUDGET_GZIP_BYTES) {
		problems.push(
			`JavaScript del sito ${jsGzipBytes} byte compressi: oltre il tetto di ${JS_BUDGET_GZIP_BYTES}`,
		);
	}

	if (
		slug !== undefined &&
		!placeholders &&
		html.some((page) => /\sdata-placeholder\b/.test(page))
	) {
		problems.push(
			`il sito "${slug}" mostra immagini segnaposto (data-placeholder): sostituirle con le foto vere`,
		);
	}
	if (slug !== undefined && !placeholders) {
		const reserved = html.some((page) =>
			formActions(page).some((action) => isReservedHost(action)),
		);
		if (reserved) {
			problems.push(
				`il sito "${slug}" ha un modulo che punta a un indirizzo non reale (.invalid, .example, .test, localhost): collegare il Worker dei moduli`,
			);
		}
	}
	if (headersFile !== undefined) {
		problems.push(...securityProblems(pages, headersFile, config ?? {}));
		if (config)
			problems.push(
				...cookieNoticeProblems(pages, config),
				...notFoundProblems(pages, config),
			);
	}
	if (robotsFile !== undefined && config) {
		const rules = "User-agent: *\nAllow: /\n";
		const valid =
			config.indexing === "block"
				? robotsFile === rules
				: robotsFile?.startsWith(rules) &&
					/^Sitemap: https?:\/\/[^/\s]+\/sitemap\.xml\n$/.test(
						robotsFile.slice(rules.length),
					);
		if (!valid) problems.push("robots.txt mancante o incoerente con indexing");
	}
	if (slug !== undefined)
		problems.push(...contentProblems(html, slug, placeholders));
	problems.push(...heroCoverProblems(css, html));
	return problems;
}
