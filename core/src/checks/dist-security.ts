import { createHash } from "node:crypto";
import {
	analyticsMode,
	antispamMode,
	type IndexingMode,
	type SiteConfig,
} from "@siti/config";
import { defaultTreeAdapter as tree } from "parse5";
import {
	ANALYTICS_CONNECT_ORIGIN,
	ANALYTICS_SCRIPT_ORIGIN,
	endpointOrigin,
	TURNSTILE_ORIGIN,
} from "../content/security.ts";
import { htmlAttr, locateCsp } from "./csp-html.ts";

export interface BuiltPage {
	path: string;
	html: string;
}

function directives(policy: string, problems: string[]) {
	const actual = new Map<string, string[]>();
	for (const clause of policy.split(";")) {
		const [name, ...sources] = clause.trim().split(/[\t\n\r\f ]+/);
		if (!name) continue;
		const key = name.toLowerCase();
		if (actual.has(key)) problems.push(`${key}: direttiva duplicata`);
		actual.set(key, sources);
		if (sources.some((source) => /^'https?:\/\//i.test(source)))
			problems.push(`${key}: host tra apici`);
		if (sources.some((source) => /^'unsafe-(?:inline|eval)'$/i.test(source)))
			problems.push(`${key}: unsafe-inline o unsafe-eval`);
	}
	return actual;
}

const astroHash = /^'sha256-[A-Za-z0-9+/]{43}='$/;

function checkDirectives(
	actual: Map<string, string[]>,
	expected: Record<string, readonly string[]>,
	problems: string[],
	hashesAllowed = false,
) {
	for (const [name, sources] of Object.entries(expected)) {
		const present = actual.get(name);
		if (!present) problems.push(`${name}: direttiva mancante`);
		else if (
			sources.some((source) => !present.includes(source)) ||
			present.some(
				(source) =>
					!sources.includes(source) &&
					!(
						hashesAllowed &&
						(name === "script-src" || name === "style-src") &&
						astroHash.test(source)
					),
			)
		)
			problems.push(`${name}: sorgenti diverse dal profilo atteso`);
	}
	for (const name of actual.keys()) {
		if (!Object.hasOwn(expected, name))
			problems.push(`${name}: direttiva non prevista`);
	}
}

function headersProblems(
	file: string | null,
	indexing: IndexingMode,
): string[] {
	if (file === null) return ["manca dist/_headers"];
	const problems: string[] = [];
	const headers = new Map<string, string>();
	let all = false;
	for (const line of file.split(/\r?\n/)) {
		const value = line.trim();
		if (!value || value.startsWith("#")) continue;
		if (!/^[\t ]/.test(line)) {
			if (value !== "/*" || all)
				problems.push("serve un solo blocco /* in _headers, senza override");
			all = true;
			continue;
		}
		const header = /^([a-z0-9-]+)\s*:\s*(.*)$/i.exec(value);
		if (!all || !header) {
			problems.push("riga di _headers non valida");
			continue;
		}
		const key = header[1].toLowerCase();
		if (headers.has(key)) problems.push(`${key}: header duplicato`);
		headers.set(key, header[2]);
	}
	if (!all) problems.push("manca il blocco /* in _headers");

	const required = {
		"strict-transport-security": /^max-age\s*=\s*31536000$/i,
		"x-content-type-options": /^nosniff$/i,
		"referrer-policy": /^strict-origin-when-cross-origin$/i,
		...(indexing === "block" ? { "x-robots-tag": /^noindex$/i } : {}),
	};
	for (const [name, check] of Object.entries(required)) {
		if (!check.test(headers.get(name) ?? ""))
			problems.push(`${name}: valore obbligatorio assente o non valido`);
	}
	const permissions = (headers.get("permissions-policy") ?? "")
		.split(",")
		.map((entry) => entry.trim());
	if (
		permissions.length !== 3 ||
		["camera", "microphone", "geolocation"].some(
			(feature) =>
				!permissions.some((entry) =>
					new RegExp(`^${feature}\\s*=\\s*\\(\\s*\\)$`, "i").test(entry),
				),
		)
	)
		problems.push(
			"permissions-policy: servono camera, microphone e geolocation disabilitate",
		);

	checkDirectives(
		directives(headers.get("content-security-policy") ?? "", problems),
		{
			"frame-ancestors": ["'none'"],
			"base-uri": ["'self'"],
			"object-src": ["'none'"],
		},
		problems,
	);
	for (const name of headers.keys()) {
		if (
			!Object.hasOwn(required, name) &&
			name !== "permissions-policy" &&
			name !== "content-security-policy"
		) {
			problems.push(`${name}: header non previsto`);
		}
	}
	return problems.map((reason) => `_headers: ${reason}`);
}

export function securityProblems(
	pages: readonly BuiltPage[],
	headers: string | null,
	config: Pick<SiteConfig, "modules"> & Partial<Pick<SiteConfig, "indexing">>,
): string[] {
	const indexing = config.indexing ?? "allow";
	const turnstile = antispamMode(config) === "turnstile";
	const analytics = analyticsMode(config) === "cloudflare";
	const origin = endpointOrigin(config.modules?.forms?.endpoint);
	const expected = {
		"default-src": ["'self'"],
		"img-src": ["'self'"],
		"font-src": ["'self'"],
		"base-uri": ["'self'"],
		"object-src": ["'none'"],
		"connect-src": ["'self'", ...(analytics ? [ANALYTICS_CONNECT_ORIGIN] : [])],
		"form-action": ["'self'", ...(origin ? [origin] : [])],
		"frame-src": [turnstile ? TURNSTILE_ORIGIN : "'none'"],
		"script-src": [
			"'self'",
			...(turnstile ? [TURNSTILE_ORIGIN] : []),
			...(analytics ? [ANALYTICS_SCRIPT_ORIGIN] : []),
		],
		"style-src": ["'self'"],
	};
	return [
		...headersProblems(headers, indexing),
		...pages.flatMap(({ path, html }) => {
			const problems: string[] = [];
			try {
				const { early, policy, elements } = locateCsp(html, path);
				const noindex = elements.filter(
					(node) =>
						node.tagName === "meta" &&
						/^(?:robots|googlebot|googlebot-news)$/i.test(
							htmlAttr(node, "name") ?? "",
						) &&
						/(?:^|[,\s])(?:noindex|none)(?=$|[,\s])/i.test(
							htmlAttr(node, "content") ?? "",
						),
				);
				if (indexing === "block" || /(?:^|\/)404\.html$/.test(path)) {
					if (
						!noindex.some(
							(node) =>
								node.parentNode?.nodeName === "head" &&
								htmlAttr(node, "name")?.toLowerCase() === "robots",
						)
					) {
						problems.push("meta robots noindex mancante nel head");
					}
				} else if (noindex.length > 0)
					problems.push("meta robots noindex non previsto");
				if (!early)
					problems.push("meta CSP deve precedere ogni risorsa dopo il charset");
				const actual = directives(policy, problems);
				checkDirectives(actual, expected, problems, true);
				for (const node of elements) {
					if (htmlAttr(node, "style") !== undefined)
						problems.push("attributo style= inline");
					if (node.attrs.some(({ name }) => /^on/i.test(name)))
						problems.push("handler inline on*");
					if (
						node.tagName === "script" &&
						(node.namespaceURI !== "http://www.w3.org/1999/xhtml" ||
							(!htmlAttr(node, "src") &&
								htmlAttr(node, "type")?.trim().toLowerCase() !==
									"application/ld+json"))
					)
						problems.push("script inline eseguibile");
					if (node.tagName === "style") {
						const content = node.childNodes
							.filter(tree.isTextNode)
							.map(({ value }) => value)
							.join("");
						const hash = `'sha256-${createHash("sha256").update(content).digest("base64")}'`;
						if (!actual.get("style-src")?.includes(hash))
							problems.push(
								"hash SHA-256 di uno style assente o non corrispondente",
							);
					}
				}
			} catch (error) {
				return [String(error)];
			}
			return [...new Set(problems)].map((reason) => `${path}: ${reason}`);
		}),
	];
}
