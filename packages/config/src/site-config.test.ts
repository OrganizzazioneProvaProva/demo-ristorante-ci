import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	allowsPlaceholders,
	analyticsMode,
	antispamMode,
	BOOKING_MODES,
	bookingMode,
	isMultilingual,
	parseFormEndpoint,
	parseSiteConfig,
} from "./site-config.ts";

const base = { slug: "pizzeria-da-mario", schemaVersion: 1 };

it("accetta una lista facoltativa di host DNS in minuscolo", () => {
	assert.equal(parseSiteConfig(base).links, undefined);
	const links = { allowedHosts: ["thefork.it", "booking.example.com"] };
	assert.deepEqual(parseSiteConfig({ ...base, links }).links, links);
	assert.deepEqual(
		parseSiteConfig({ ...base, links: { allowedHosts: [] } }).links
			?.allowedHosts,
		[],
	);
});

it("rifiuta voci della lista diverse da semplici host DNS in minuscolo", () => {
	for (const host of [
		"TheFork.IT",
		"https://thefork.it",
		"thefork.it/a",
		"*.thefork.it",
		"thefork.it:443",
		"localhost",
		"127.0.0.1",
		"0x7f.0.0.1",
		"2130706433",
		"[::1]",
		"bad..it",
		" thefork.it",
	]) {
		assert.throws(
			() => parseSiteConfig({ ...base, links: { allowedHosts: [host] } }),
			/allowedHosts/,
			host,
		);
	}
});

describe("indicizzazione", () => {
	it("abilita i siti normali per default e accetta un blocco esplicito", () => {
		assert.equal(parseSiteConfig(base).indexing, "allow");
		assert.equal(
			parseSiteConfig({ ...base, indexing: "block" }).indexing,
			"block",
		);
		assert.throws(
			() => parseSiteConfig({ ...base, indexing: "yes" }),
			/indexing/,
		);
	});

	it("per i demo il default è block e allow è vietato", () => {
		const demo = { ...base, slug: "prova", kind: "demo" };
		assert.equal(parseSiteConfig(demo).indexing, "block");
		assert.equal(
			parseSiteConfig({ ...demo, indexing: "block" }).indexing,
			"block",
		);
		assert.throws(
			() => parseSiteConfig({ ...demo, indexing: "allow" }),
			/indexing: block/,
		);
	});
});

describe("siteConfigSchema", () => {
	it("applica italiano come lingua principale e unica lingua per impostazione predefinita", () => {
		const config = parseSiteConfig(base);
		assert.equal(config.defaultLanguage, "it");
		assert.deepEqual(config.languages, ["it"]);
		assert.equal(isMultilingual(config), false);
	});

	it("accetta italiano e inglese", () => {
		const config = parseSiteConfig({ ...base, languages: ["it", "en"] });
		assert.deepEqual(config.languages, ["it", "en"]);
		assert.equal(isMultilingual(config), true);
	});

	it("rifiuta una lingua principale che non è tra quelle attive", () => {
		assert.throws(() =>
			parseSiteConfig({ ...base, defaultLanguage: "en", languages: ["it"] }),
		);
	});

	it("rifiuta lingue duplicate", () => {
		assert.throws(() => parseSiteConfig({ ...base, languages: ["it", "it"] }));
	});

	it("rifiuta una lingua non supportata", () => {
		assert.throws(() => parseSiteConfig({ ...base, languages: ["it", "fr"] }));
	});

	it("rifiuta un elenco di lingue vuoto", () => {
		assert.throws(() => parseSiteConfig({ ...base, languages: [] }));
	});

	it("rifiuta uno slug non valido", () => {
		assert.throws(() =>
			parseSiteConfig({ ...base, slug: "Pizzeria Da Mario" }),
		);
		assert.throws(() => parseSiteConfig({ ...base, slug: "../altro" }));
	});

	it("rifiuta chiavi sconosciute (errori di battitura)", () => {
		assert.throws(() => parseSiteConfig({ ...base, langauges: ["it"] }));
	});

	it("rifiuta una versione degli schemi non intera o non positiva", () => {
		assert.throws(() => parseSiteConfig({ ...base, schemaVersion: 0 }));
		assert.throws(() => parseSiteConfig({ ...base, schemaVersion: 1.5 }));
	});
});

describe("modulo prenotazioni", () => {
	it("senza il campo la modalità è `request` (il comportamento di prima)", () => {
		assert.equal(bookingMode(parseSiteConfig(base)), "request");
		assert.equal(
			bookingMode(parseSiteConfig({ ...base, modules: {} })),
			"request",
		);
	});

	it("accetta le tre modalità", () => {
		for (const booking of BOOKING_MODES) {
			const config = parseSiteConfig({ ...base, modules: { booking } });
			assert.equal(bookingMode(config), booking);
		}
	});

	it("rifiuta un valore sconosciuto e un modulo sconosciuto", () => {
		assert.throws(() =>
			parseSiteConfig({ ...base, modules: { booking: "tavoli" } }),
		);
		assert.throws(() =>
			parseSiteConfig({ ...base, modules: { newsletter: "x" } }),
		);
	});
});

describe("tipo di sito e segnaposto", () => {
	it("un sito è `site` se non dice altro", () => {
		assert.equal(parseSiteConfig(base).kind, "site");
	});

	it("i segnaposto servono sia `kind: demo` sia lo slug giusto", () => {
		assert.equal(allowsPlaceholders({ slug: "prova", kind: "demo" }), true);
		assert.equal(
			allowsPlaceholders({ slug: "demo-ristorante", kind: "demo" }),
			true,
		);
		// uno slug da demo senza `kind` resta un sito vero (un cliente chiamato demo-qualcosa)
		assert.equal(allowsPlaceholders({ slug: "demo-x" }), false);
		assert.equal(allowsPlaceholders({ slug: "prova", kind: "site" }), false);
		assert.equal(
			allowsPlaceholders({ slug: "pizzeria-da-mario", kind: "demo" }),
			false,
		);
	});

	it("`kind: demo` con uno slug da cliente è un errore di configurazione", () => {
		assert.throws(() => parseSiteConfig({ ...base, kind: "demo" }), /demo/);
		assert.ok(
			parseSiteConfig({
				slug: "demo-ristorante",
				schemaVersion: 1,
				kind: "demo",
			}),
		);
	});
});

describe("moduli moduli, antispam e statistiche", () => {
	it("predefiniti: nessun antispam e nessuna statistica", () => {
		assert.equal(antispamMode(parseSiteConfig(base)), "none");
		assert.equal(analyticsMode(parseSiteConfig(base)), "none");
	});

	it("la destinazione del modulo è un https assoluto o un percorso del sito", () => {
		for (const [endpoint, canonical] of [
			[
				"HTTPS://MODULI.ESEMPIO.IT:8443/a/../richiesta?source=site",
				"https://moduli.esempio.it:8443/richiesta?source=site",
			],
			["/api/../richiesta?lang=it", "/richiesta?lang=it"],
		] as const) {
			assert.equal(parseFormEndpoint(endpoint)?.href, canonical);
			assert.equal(
				parseSiteConfig({ ...base, modules: { forms: { endpoint } } }).modules
					?.forms?.endpoint,
				canonical,
			);
		}
		for (const endpoint of [
			"http://x.it/f",
			"//external.example/f",
			"/\\external.example/f",
			"javascript:alert(1)",
			"https:external.example/r",
			"https:///external.example/r",
			"https://utente@external.example/",
			"https://@external.example/",
			"https://external.example:65536/",
			"https://external.example:/",
			"https://external.example/r#ref",
			"https://external.example/r#",
			"https://external.example/\u0000",
			"https://external.example/\t",
			"richiesta",
			"/a b",
			"/a/..//external.example/r",
			"/%2e%2e//external.example/r",
		]) {
			assert.equal(
				parseFormEndpoint(endpoint),
				undefined,
				JSON.stringify(endpoint),
			);
			assert.throws(
				() => parseSiteConfig({ ...base, modules: { forms: { endpoint } } }),
				/serve un indirizzo https/,
			);
		}
	});

	it("ammette tutte le cinque chiavi pubbliche di test solo con allowsPlaceholders", () => {
		for (const turnstileSiteKey of [
			"1x00000000000000000000AA",
			"2x00000000000000000000AB",
			"1x00000000000000000000BB",
			"2x00000000000000000000BB",
			"3x00000000000000000000FF",
		]) {
			for (const antispam of [undefined, "none", "turnstile"] as const) {
				const modules = { antispam, forms: { turnstileSiteKey } };
				assert.ok(
					parseSiteConfig({ ...base, slug: "prova", kind: "demo", modules }),
				);
				for (const kind of [undefined, "site"]) {
					assert.throws(
						() => parseSiteConfig({ ...base, kind, modules }),
						/chiavi pubbliche di test/,
					);
				}
			}
		}
		assert.ok(
			parseSiteConfig({
				...base,
				modules: { forms: { turnstileSiteKey: "1x00000000000000000000Aa" } },
			}),
		);
	});

	it("con antispam turnstile serve la chiave pubblica; senza chiave si ferma", () => {
		assert.throws(
			() => parseSiteConfig({ ...base, modules: { antispam: "turnstile" } }),
			/chiave pubblica/,
		);
		const config = parseSiteConfig({
			...base,
			modules: {
				antispam: "turnstile",
				forms: { turnstileSiteKey: "SyntheticPublicSiteKey123" },
			},
		});
		assert.equal(antispamMode(config), "turnstile");
	});

	it("rifiuta valori e moduli sconosciuti", () => {
		assert.throws(() =>
			parseSiteConfig({ ...base, modules: { antispam: "recaptcha" } }),
		);
		assert.throws(() =>
			parseSiteConfig({ ...base, modules: { analytics: "google" } }),
		);
		assert.throws(() =>
			parseSiteConfig({ ...base, modules: { forms: { secret: "x" } } }),
		);
	});
});
