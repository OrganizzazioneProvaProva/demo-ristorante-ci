import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig, type SiteKind } from "@siti/config";
import {
	checkSite as checkBuiltSite,
	cookieNoticeProblems,
	forbiddenKeyframeProperties,
	heroCoverProblems,
	JS_BUDGET_GZIP_BYTES,
	JS_WARN_GZIP_BYTES,
	jsonLdProblems,
	motionLevelProblems,
	notFoundProblems,
	PROBE_CLASSES,
	REQUIRED_VARIABLES,
	SENTINEL_CLASS,
	type SiteFiles,
	selectorOf,
	siteWarnings,
	TEST_ONLY_SELECTORS,
	withoutNoPreferenceBlocks,
} from "./check-site.ts";

import { securityProblems } from "./dist-security.ts";

const fixturePages = (html: string[]) =>
	html.map((page, index) => ({ path: `pagina-${index}.html`, html: page }));

function checkSite({
	html = [],
	slug,
	kind,
	...fixture
}: Omit<SiteFiles, "pages" | "config"> & {
	html?: string[];
	slug?: string;
	kind?: SiteKind;
}) {
	return checkBuiltSite({
		...fixture,
		pages: fixturePages(html),
		config:
			slug === undefined
				? undefined
				: parseSiteConfig({ slug, kind, schemaVersion: 1 }),
	});
}

const goodCss = () =>
	[
		...PROBE_CLASSES.map((name) => `${selectorOf(name)}{}`),
		...REQUIRED_VARIABLES.map((name) => `:root{${name}x}`),
		"@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms}}",
		"@media (hover: hover) and (pointer: fine){.x:hover{}}",
		'@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}html:not([data-motion="no-animation"]) a{}html[data-motion="expressive-animation"] a{}}',
	].join("\n");

const page = (level = "light-animation", body = "") =>
	`<html lang="it" data-motion="${level}"><body>${body}</body></html>`;

const LEGAL_NAV =
	'<nav aria-label="Informazioni legali" data-legal-links><ul><li><a href="/privacy/">a</a></li><li><a href="/cookie/">b</a></li><li><a href="/note-legali/">c</a></li><li><a href="/accessibilita/">d</a></li></ul></nav>';

/** Pagina completa di un sito vero: title, description e link legali nel piè di pagina. */
const fullPage = (
	body = "",
	{ lang = "it", title = "Menu", description = "Il menu." } = {},
) =>
	`<html lang="${lang}" data-motion="light-animation"><head><title>${title}</title><meta name="description" content="${description}"></head><body>${body}<footer>${LEGAL_NAV}</footer></body></html>`;

describe("selectorOf", () => {
	it("scrive il selettore con i due punti protetti", () => {
		assert.equal(
			selectorOf("hover:bg-accent-hover"),
			".hover\\:bg-accent-hover",
		);
	});
});

describe("selectorOf (altri caratteri)", () => {
	it("protegge anche il punto e le parentesi delle classi di Tailwind", () => {
		assert.equal(selectorOf("py-2.5"), ".py-2\\.5");
		assert.equal(selectorOf("w-[10%]"), ".w-\\[10\\%\\]");
	});
});

describe("checkSite", () => {
	it("segnala un hover limitato solo a (hover: hover), senza pointer: fine", () => {
		const css = goodCss().replace(" and (pointer: fine)", "");
		assert.match(checkSite({ css, sources: [] })[0] ?? "", /pointer: fine/);
	});

	it("--t-accent non è soddisfatto da --t-accent-hover (confronto con i due punti)", () => {
		const css = goodCss().replace(":root{--t-accent:x}", ":root{}");
		assert.match(checkSite({ css, sources: [] })[0] ?? "", /--t-accent:/);
	});

	it("un CSS con tutte le classi e le regole non ha problemi", () => {
		assert.deepEqual(checkSite({ css: goodCss(), sources: [] }), []);
	});

	it("segnala una classe del core assente (@source rotto)", () => {
		const css = goodCss().replace(selectorOf("bg-accent"), ".altro");
		const [problem] = checkSite({ css, sources: [] });
		assert.match(problem ?? "", /mancano: \.bg-accent/);
	});

	it("segnala quando manca la larghezza della pagina Contatti", () => {
		const css = goodCss().replace(".max-w-2xl{}", "");
		assert.match(
			checkSite({ css, sources: [] })[0] ?? "",
			/mancano: \.max-w-2xl/,
		);
	});

	it("segnala una variabile del livello base assente", () => {
		const css = goodCss().replace("--color-bg:x", "--altro:x");
		assert.match(checkSite({ css, sources: [] })[0] ?? "", /--color-bg:/);
	});

	it("segnala l'assenza della regola del movimento ridotto", () => {
		const css = goodCss().replace("prefers-reduced-motion: reduce", "print");
		assert.deepEqual(checkSite({ css, sources: [] }), [
			"manca la regola di prefers-reduced-motion",
		]);
	});

	it("segnala un CSS che segue prefers-color-scheme", () => {
		const css = `${goodCss()}\n@media (prefers-color-scheme: dark){a{}}`;
		assert.match(
			checkSite({ css, sources: [] })[0] ?? "",
			/prefers-color-scheme/,
		);
	});

	it("segnala classi del core copiate in un file del sito", () => {
		const sources = [`<a class="${SENTINEL_CLASS}">x</a>`];
		assert.match(
			checkSite({ css: goodCss(), sources })[0] ?? "",
			/classi del core/,
		);
	});

	it("un sito che usa classi comuni come inline-flex non è un problema", () => {
		const sources = [
			'<div class="inline-flex items-center rounded-ui">x</div>',
		];
		assert.deepEqual(checkSite({ css: goodCss(), sources }), []);
	});

	it("segnala le classi dei test del core finite nel CSS (@source not rotto)", () => {
		const css = `${goodCss()}\n${TEST_ONLY_SELECTORS[0]}{}`;
		assert.match(
			checkSite({ css, sources: [] })[0] ?? "",
			/classi dei test del core/,
		);
	});

	it("senza CSS fallisce subito", () => {
		assert.deepEqual(checkSite({ css: "", sources: [] }), [
			"il sito non ha CSS compilato",
		]);
	});

	it("i segnaposto sono ammessi nei siti prova e demo-*, vietati negli altri", () => {
		const html = [fullPage('<img src="x" data-placeholder>')];
		assert.deepEqual(
			checkSite({
				css: goodCss(),
				sources: [],
				html,
				slug: "demo-ristorante",
				kind: "demo",
			}),
			[],
		);
		assert.deepEqual(
			checkSite({
				css: goodCss(),
				sources: [],
				html,
				slug: "prova",
				kind: "demo",
			}),
			[],
		);
		const [problem] = checkSite({
			css: goodCss(),
			sources: [],
			html,
			slug: "pizzeria-da-mario",
		});
		assert.match(problem ?? "", /segnaposto/);
	});

	it("slug demo-* senza `kind: demo` non basta: i segnaposto restano vietati", () => {
		const html = [fullPage('<img src="x" data-placeholder>')];
		const [problem] = checkSite({
			css: goodCss(),
			sources: [],
			html,
			slug: "demo-x",
		});
		assert.match(problem ?? "", /segnaposto/);
	});

	it("un modulo con indirizzo non reale (.invalid, .example, .test, localhost) è ammesso solo nei siti demo", () => {
		const html = [
			fullPage(
				'<form method="post" action="https://form.invalid/richiesta"></form>',
			),
		];
		assert.deepEqual(
			checkSite({
				css: goodCss(),
				sources: [],
				html,
				slug: "demo-ristorante",
				kind: "demo",
			}),
			[],
		);
		for (const host of ["form.invalid", "m.example", "x.test", "localhost"]) {
			const bad = [
				fullPage(`<form method="post" action="https://${host}/r"></form>`),
			];
			const [problem] = checkSite({
				css: goodCss(),
				sources: [],
				html: bad,
				slug: "pizzeria-da-mario",
			});
			assert.match(problem ?? "", /non reale/, host);
		}
		const real = [
			fullPage(
				'<form method="post" action="https://moduli.esempio.it/r"></form>',
			),
		];
		assert.deepEqual(
			checkSite({
				css: goodCss(),
				sources: [],
				html: real,
				slug: "pizzeria-da-mario",
			}),
			[],
		);
	});

	describe("sicurezza: CSP e _headers", () => {
		const policy = [
			"default-src 'self'",
			"img-src 'self'",
			"font-src 'self'",
			"connect-src 'self'",
			"form-action 'self'",
			"frame-src 'none'",
			"base-uri 'self'",
			"object-src 'none'",
			"script-src 'self'",
			"style-src 'self'",
		].join("; ");
		const page = (csp: string, body = "") =>
			`<!doctype html><html><head><meta charset=utf-8><meta content="${csp}" http-equiv=content-security-policy></head><body>${body}</body></html>`;
		const headers = [
			"/*",
			"  strict-transport-security: MAX-AGE=31536000",
			"  X-Content-Type-Options: nosniff",
			"  Referrer-Policy: strict-origin-when-cross-origin",
			"  Permissions-Policy: microphone = (), geolocation=(), camera=()",
			"  Content-Security-Policy: object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
		].join("\n");

		it("verifica il profilo, le intestazioni e il JSON-LD inerte", () => {
			const body =
				'<script src="/_astro/x.js" type="module"></script><script type="application/ld+json">{"@type":"Thing"}</script>';
			assert.deepEqual(
				securityProblems(fixturePages([page(policy, body)]), headers, {}),
				[],
			);
		});

		it("vincola Analytics, frame e destinazione alla configurazione", () => {
			const active = policy
				.replace(
					"connect-src 'self'",
					"connect-src 'self' https://cloudflareinsights.com",
				)
				.replace(
					"script-src 'self'",
					"script-src 'self' https://static.cloudflareinsights.com",
				)
				.replace(
					"form-action 'self'",
					"form-action 'self' https://forms.example:8443",
				);
			const config = {
				modules: {
					analytics: "cloudflare",
					forms: { endpoint: "https://forms.example:8443/send?tag=static" },
				},
			} as const;
			assert.deepEqual(
				securityProblems(fixturePages([page(active)]), headers, config),
				[],
			);
			assert.match(
				securityProblems(fixturePages([page(active)]), headers, {}).join(" "),
				/connect-src: sorgenti/,
			);
			assert.match(
				securityProblems(fixturePages([page(active)]), headers, {}).join(" "),
				/form-action: sorgenti/,
			);
		});

		it("rifiuta direttive duplicate, sconosciute, wildcard e host tra apici", () => {
			for (const [edit, reason] of [
				[`${policy}; Font-Src 'self'`, /font-src: direttiva duplicata/],
				[`${policy}; sandbox`, /sandbox: direttiva non prevista/],
				[policy.replace("img-src 'self'", "img-src *"), /img-src: sorgenti/],
				[
					policy.replace(
						"font-src 'self'",
						"font-src 'self' 'https://cdn.example'",
					),
					/font-src: host tra apici/,
				],
			] as const) {
				assert.match(
					securityProblems(fixturePages([page(edit)]), headers, {}).join(" "),
					reason,
				);
			}
		});

		it("checkSite verifica dist/_headers quando richiesto", () => {
			assert.match(
				checkSite({ css: goodCss(), sources: [], headersFile: null }).join(" "),
				/manca dist\/_headers/,
			);
		});

		it("verifica in entrambe le direzioni le mutazioni del meta noindex e di X-Robots-Tag", () => {
			const plain = page(policy);
			const marked = plain.replace(
				"</head>",
				'<meta content="noindex" name="ROBOTS"></head>',
			);
			const block = { indexing: "block" } as const;
			const restricted = `${headers}\n  X-Robots-Tag: noindex`;
			assert.deepEqual(
				securityProblems(fixturePages([plain]), headers, {}),
				[],
			);
			assert.deepEqual(
				securityProblems(fixturePages([marked]), restricted, block),
				[],
			);
			assert.match(
				securityProblems(fixturePages([marked]), headers, {}).join(" "),
				/noindex non previsto/,
			);
			assert.match(
				securityProblems(fixturePages([plain]), restricted, block).join(" "),
				/noindex mancante/,
			);
			assert.match(
				securityProblems(fixturePages([plain]), restricted, {}).join(" "),
				/x-robots-tag: header non previsto/,
			);
			assert.match(
				securityProblems(fixturePages([marked]), headers, block).join(" "),
				/x-robots-tag: valore obbligatorio/,
			);
			assert.deepEqual(
				securityProblems([{ path: "en/404.html", html: marked }], headers, {}),
				[],
			);
			assert.match(
				securityProblems([{ path: "404.html", html: plain }], headers, {}).join(
					" ",
				),
				/noindex mancante/,
			);
		});
	});

	describe("contenuto delle pagine", () => {
		const check = (html: string[], slug = "pizzeria-da-mario") =>
			checkSite({
				css: goodCss(),
				sources: [],
				html,
				slug,
				kind:
					slug === "prova" || slug === "demo-ristorante" ? "demo" : undefined,
			});

		it("una pagina completa passa", () => {
			assert.deepEqual(check([fullPage()]), []);
		});

		it("title e description sono obbligatori", () => {
			const bare = `<html lang="it"><body>${LEGAL_NAV}</body></html>`;
			const text = check([bare]).join(" ");
			assert.match(text, /senza <title>/);
			assert.match(text, /senza meta description/);
		});

		it("title e description uguali nella stessa lingua sono un errore; in lingue diverse no", () => {
			const text = check([fullPage(), fullPage()]).join(" ");
			assert.match(text, /title duplicato in it/);
			assert.match(text, /description duplicato in it/);
			assert.deepEqual(check([fullPage(), fullPage("", { lang: "en" })]), []);
		});

		it("senza i link legali nel piè di pagina la build si ferma, tranne nel banco di prova", () => {
			const noLegal = `<html lang="it" data-motion="light-animation"><head><title>t</title><meta name="description" content="d"></head><body></body></html>`;
			assert.match(check([noLegal]).join(" "), /pagine legali/);
			assert.deepEqual(check([noLegal], "prova"), []);
			const three = fullPage().replace(
				/<li><a href="\/accessibilita\/">d<\/a><\/li>/,
				"",
			);
			assert.match(check([three]).join(" "), /pagine legali/);
		});

		it("i testi legali segnaposto sono ammessi solo in prova e demo-*", () => {
			const html = [fullPage("<section data-legal-placeholder></section>")];
			assert.deepEqual(check(html, "demo-ristorante"), []);
			assert.deepEqual(check(html, "prova"), []);
			assert.match(check(html).join(" "), /testi legali segnaposto/);
		});
	});

	it("verifica i blocchi cookie effettivi per ogni lingua, anche nel banco prova", () => {
		const config = parseSiteConfig({
			slug: "prova",
			kind: "demo",
			schemaVersion: 1,
			languages: ["it", "en"],
			modules: { analytics: "cloudflare" },
		});
		const cookie = (language: string, markup: string) => ({
			path: language === "it" ? "cookie/index.html" : "en/cookie/index.html",
			html: `<!doctype html><html lang="${language}"><main>${markup}</main></html>`,
		});
		const analytics = '<p data-cookie-tool="analytics">Web Analytics</p>';
		const pages = [cookie("it", analytics), cookie("en", analytics)];
		assert.deepEqual(cookieNoticeProblems(pages, config), []);
		assert.match(
			cookieNoticeProblems(pages.slice(0, 1), config)[0] ?? "",
			/en\/cookie.*mancante/,
		);
		for (const markup of [
			`<!-- ${analytics} -->`,
			`<template>${analytics}</template>`,
			'<p data-cookie-tool="none">No tools.</p>',
		]) {
			assert.match(
				cookieNoticeProblems([pages[0], cookie("en", markup)], config)[0] ?? "",
				/en\/cookie.*incoerente/,
			);
		}
	});

	it("una foto vera senza data-placeholder passa in ogni sito", () => {
		const html = [fullPage('<img src="x" alt="y">')];
		assert.deepEqual(
			checkSite({
				css: goodCss(),
				sources: [],
				html,
				slug: "pizzeria-da-mario",
			}),
			[],
		);
	});
});

describe("artefatti 404", () => {
	it("richiede il file, il percorso e la lingua di ciascuna versione", () => {
		const config = { languages: ["it", "en"], defaultLanguage: "it" } as const;
		const pages = [
			{ path: "404.html", html: '<html lang="it">' },
			{ path: "en/404.html", html: '<html lang="en">' },
		];
		assert.deepEqual(
			notFoundProblems(pages, { ...config, languages: [...config.languages] }),
			[],
		);
		assert.match(
			notFoundProblems(pages.slice(0, 1), {
				...config,
				languages: [...config.languages],
			})[0] ?? "",
			/en\/404\.html: pagina 404 mancante/,
		);
		assert.match(
			notFoundProblems([pages[0], { ...pages[1], html: pages[0].html }], {
				...config,
				languages: [...config.languages],
			})[0] ?? "",
			/en\/404\.html: lingua.*en/,
		);
	});
});

describe("livelli di movimento", () => {
	const noPref = (inner: string) =>
		`@media (prefers-reduced-motion:no-preference){${inner}}`;

	it("un sito con il livello leggero, espressivo o senza animazioni (CSS coerente) non ha problemi", () => {
		for (const level of ["light-animation", "expressive-animation"]) {
			assert.deepEqual(
				motionLevelProblems(goodCss(), [page(level), page(level)]),
				[],
			);
		}
		const withoutTransition = goodCss().replace(
			"@view-transition{navigation:auto}",
			"",
		);
		assert.deepEqual(
			motionLevelProblems(withoutTransition, [page("no-animation")]),
			[],
		);
	});

	it("segnala le regole dei livelli assenti dal CSS", () => {
		const noExpressive = goodCss().replace(
			'html[data-motion="expressive-animation"] a{}',
			"",
		);
		assert.match(
			motionLevelProblems(noExpressive, [page()])[0] ?? "",
			/livello espressivo/,
		);
		const noExclusion = goodCss().replace(
			'html:not([data-motion="no-animation"]) a{}',
			"",
		);
		assert.match(
			motionLevelProblems(noExclusion, [page()])[0] ?? "",
			/no-animation/,
		);
	});

	it("segnala una pagina senza data-motion, con un livello sconosciuto o diverso dalle altre", () => {
		assert.match(
			motionLevelProblems(goodCss(), [
				"<html lang=it><body></body></html>",
			])[0] ?? "",
			/non ha <html data-motion>/,
		);
		assert.match(
			motionLevelProblems(goodCss(), [page("no_animation")])[0] ?? "",
			/non valido: no_animation/,
		);
		assert.match(
			motionLevelProblems(goodCss(), [
				page("light-animation"),
				page("expressive-animation"),
			])[0] ?? "",
			/livelli di movimento diversi/,
		);
	});

	it("il cambio di pagina nativo c'è se e solo se il livello non è no-animation", () => {
		assert.match(
			motionLevelProblems(goodCss(), [page("no-animation")])[0] ?? "",
			/no-animation ma il CSS contiene @view-transition/,
		);
		const withoutTransition = goodCss().replace(
			"@view-transition{navigation:auto}",
			noPref(""),
		);
		assert.match(
			motionLevelProblems(withoutTransition, [page("light-animation")])[0] ??
				"",
			/non contiene @view-transition/,
		);
	});
});

describe("controlli sul movimento", () => {
	const noPref = "@media (prefers-reduced-motion:no-preference)";

	it("toglie i blocchi no-preference anche annidati", () => {
		const css = `a{}${noPref}{@supports (animation-timeline:view()){b{animation-timeline:view()}}@media (max-width:1px){c{}}}d{}`;
		assert.equal(withoutNoPreferenceBlocks(css), "a{}d{}");
	});

	it("animation-timeline e @view-transition dentro no-preference sono ammessi, fuori no", () => {
		const inside = `${goodCss()}\n${noPref}{@view-transition{navigation:auto}x{animation-timeline:view()}}`;
		assert.deepEqual(checkSite({ css: inside, sources: [] }), []);
		const outside = `${goodCss()}\n@view-transition{navigation:auto}`;
		assert.match(
			checkSite({ css: outside, sources: [] })[0] ?? "",
			/fuori da prefers-reduced-motion/,
		);
		const timeline = `${goodCss()}\nx{animation-timeline:scroll()}`;
		assert.match(
			checkSite({ css: timeline, sources: [] })[0] ?? "",
			/fuori da prefers-reduced-motion/,
		);
	});

	it("vieta transition: all e transition-property: all", () => {
		for (const bad of ["a{transition:all .2s}", "a{transition-property:all}"]) {
			assert.match(
				checkSite({ css: `${goodCss()}\n${bad}`, sources: [] })[0] ?? "",
				/transition: all/,
			);
		}
	});

	it("i @keyframes possono animare solo opacity, transform, translate, scale, rotate", () => {
		assert.deepEqual(
			forbiddenKeyframeProperties(
				"@keyframes a{from{opacity:0;translate:0 1rem}to{opacity:1}}",
			),
			[],
		);
		assert.deepEqual(
			forbiddenKeyframeProperties(
				"@keyframes b{from{height:0;margin-top:1px}to{height:10px}}",
			).sort(),
			["height", "margin-top"],
		);
		const css = `${goodCss()}\n@keyframes b{from{height:0}to{height:10px}}`;
		assert.match(
			checkSite({ css, sources: [] })[0] ?? "",
			/@keyframes animano proprietà non ammesse: height/,
		);
	});

	it("il JavaScript oltre il tetto è un problema", () => {
		assert.deepEqual(
			checkSite({
				css: goodCss(),
				sources: [],
				jsGzipBytes: JS_BUDGET_GZIP_BYTES,
			}),
			[],
		);
		assert.match(
			checkSite({
				css: goodCss(),
				sources: [],
				jsGzipBytes: JS_BUDGET_GZIP_BYTES + 1,
			})[0] ?? "",
			/oltre il tetto/,
		);
	});

	it("tra la soglia di avviso e il tetto il JavaScript dà un avviso ma non ferma la build", () => {
		const jsGzipBytes = JS_WARN_GZIP_BYTES + 1;
		assert.deepEqual(
			checkSite({ css: goodCss(), sources: [], jsGzipBytes }),
			[],
		);
		assert.match(siteWarnings({ jsGzipBytes })[0] ?? "", /soglia di avviso/);
		assert.deepEqual(siteWarnings({ jsGzipBytes: JS_WARN_GZIP_BYTES }), []);
		assert.deepEqual(
			siteWarnings({ jsGzipBytes: JS_BUDGET_GZIP_BYTES + 1 }),
			[],
		);
		assert.deepEqual(siteWarnings({}), []);
	});

	it("classi sonda di un altro pacchetto (il preset) devono essere nel CSS del sito", () => {
		const extra = ["bg-pop", "text-pop-ink"];
		assert.match(
			checkSite({ css: goodCss(), sources: [], extraProbeClasses: extra })[0] ??
				"",
			/mancano: \.bg-pop, \.text-pop-ink/,
		);
		const css = `${goodCss()}\n.bg-pop{}.text-pop-ink{}`;
		assert.deepEqual(
			checkSite({ css, sources: [], extraProbeClasses: extra }),
			[],
		);
	});

	it("un blocco JSON-LD valido, con l'escape giusto, passa", () => {
		const html =
			'<script type="application/ld+json">{"@context":"https://schema.org","@type":"Restaurant","name":"A \\u003c B"}</script>';
		assert.deepEqual(jsonLdProblems(html), []);
		assert.deepEqual(
			checkSite({
				css: goodCss(),
				sources: [],
				html: [page("light-animation", html)],
			}),
			[],
		);
	});

	it("un JSON-LD con < > & grezzi, non valido o senza @type è un problema", () => {
		const wrap = (text: string) =>
			`<script type="application/ld+json">${text}</script>`;
		assert.match(
			jsonLdProblems(
				wrap('{"@context":"https://schema.org","@type":"X","a":"<b>"}'),
			)[0] ?? "",
			/non esclusi/,
		);
		assert.match(
			jsonLdProblems(
				wrap('{"@context":"https://schema.org","@type":"X","a":"a&b"}'),
			)[0] ?? "",
			/non esclusi/,
		);
		assert.deepEqual(jsonLdProblems(wrap("{rotto")), [
			"JSON-LD non è JSON valido",
		]);
		assert.deepEqual(
			jsonLdProblems(wrap('{"@context":"https://schema.org"}')),
			["JSON-LD senza @context o @type"],
		);
		assert.match(
			checkSite({
				css: goodCss(),
				sources: [],
				html: [page("light-animation", wrap("{rotto"))],
			})[0] ?? "",
			/JSON-LD/,
		);
	});
});

describe("hero a tutto schermo: contrasto del titolo sul velo", () => {
	const cover = ["<section data-hero-cover><h1>x</h1></section>"];
	const good = ":root{--t-ink:#0E2A47;--t-bg:#F4F7F5}";

	it("senza hero cover non controlla nulla", () => {
		assert.deepEqual(heroCoverProblems("", ["<html></html>"]), []);
		assert.deepEqual(
			heroCoverProblems(":root{--t-ink:#888888;--t-bg:#999999}", [
				"<html></html>",
			]),
			[],
		);
	});

	it("con colori che passano non ci sono problemi", () => {
		assert.deepEqual(heroCoverProblems(good, cover), []);
	});

	it("un titolo poco leggibile sul velo ferma la build (controllo negativo)", () => {
		const [problem] = heroCoverProblems(
			":root{--t-ink:#8899AA;--t-bg:#99AABB}",
			cover,
		);
		assert.match(problem ?? "", /caso peggiore/);
	});

	it("senza i colori nel CSS non si può verificare e lo dice", () => {
		const [problem] = heroCoverProblems(":root{}", cover);
		assert.match(problem ?? "", /mancano --t-ink e --t-bg/);
	});
});
