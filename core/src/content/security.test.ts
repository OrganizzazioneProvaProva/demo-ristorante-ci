import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import {
	contactFormForSite,
	PLACEHOLDER_FORM_ENDPOINT,
} from "./contact-form.ts";
import {
	astroCsp,
	cspDirectives,
	endpointOrigin,
	isReservedHost,
	parseHeadersFile,
	REQUIRED_HEADERS,
	scriptSources,
	securityHeaders,
} from "./security.ts";

const base = { slug: "t", schemaVersion: 1 };
const cfg = (modules?: object) => parseSiteConfig({ ...base, modules });

describe("CSP dai moduli", () => {
	it("senza moduli è tutta 'self', senza terzi", () => {
		const text = cspDirectives(cfg()).join("; ");
		assert.match(text, /default-src 'self'/);
		assert.match(text, /form-action 'self'(;|$)/);
		assert.match(text, /frame-src 'none'/);
		assert.match(text, /connect-src 'self'(;|$)/);
		assert.equal(text.includes("https://"), false);
		assert.deepEqual(scriptSources(cfg()), ["'self'"]);
	});

	it("un endpoint assoluto entra in form-action, uno relativo no (resta 'self')", () => {
		const abs = cspDirectives(
			cfg({ forms: { endpoint: "https://moduli.esempio.it/richiesta" } }),
		).join("; ");
		assert.match(abs, /form-action 'self' https:\/\/moduli\.esempio\.it(;|$)/);
		const rel = cspDirectives(
			cfg({ forms: { endpoint: "/api/richiesta" } }),
		).join("; ");
		assert.match(rel, /form-action 'self'(;|$)/);
		assert.equal(endpointOrigin("https://a.it/b?c=1"), "https://a.it");
		assert.equal(endpointOrigin("/api/x"), undefined);
		assert.equal(endpointOrigin(undefined), undefined);
	});

	it("modello e form-action usano lo stesso endpoint canonico, con porta e query", () => {
		const config = cfg({
			forms: { endpoint: "HTTPS://FORM.EXAMPLE.IT:8443/a/../send?source=test" },
		});
		const { endpoint } = contactFormForSite(config, "it");
		assert.equal(endpoint, "https://form.example.it:8443/send?source=test");
		assert.ok(
			cspDirectives(config).includes(
				`form-action 'self' ${new URL(endpoint).origin}`,
			),
		);
		assert.equal(
			contactFormForSite(cfg(), "it").endpoint,
			PLACEHOLDER_FORM_ENDPOINT,
		);
		assert.ok(cspDirectives(cfg()).includes("form-action 'self'"));
		assert.equal(endpointOrigin("https:invalid.example"), undefined);
	});

	it("Turnstile apre script-src e frame-src solo verso Cloudflare, e 'self' resta", () => {
		const turnstile = cfg({
			antispam: "turnstile",
			forms: { turnstileSiteKey: "SyntheticPublicSiteKey123" },
		});
		assert.deepEqual(scriptSources(turnstile), [
			"'self'",
			"https://challenges.cloudflare.com",
		]);
		assert.match(
			cspDirectives(turnstile).join("; "),
			/frame-src https:\/\/challenges\.cloudflare\.com/,
		);
	});

	it("le statistiche aprono lo script e il beacon di Cloudflare, e solo se attive", () => {
		const on = cfg({ analytics: "cloudflare" });
		assert.ok(
			scriptSources(on).includes("https://static.cloudflareinsights.com"),
		);
		assert.match(
			cspDirectives(on).join("; "),
			/connect-src 'self' https:\/\/cloudflareinsights\.com/,
		);
		assert.equal(scriptSources(cfg({ analytics: "none" })).length, 1);
	});

	it("gli host non hanno apici (con gli apici il browser li ignora)", () => {
		const all = cfg({
			antispam: "turnstile",
			analytics: "cloudflare",
			forms: {
				endpoint: "https://m.esempio.it/r",
				turnstileSiteKey: "SyntheticPublicSiteKey123",
			},
		});
		const text = [...cspDirectives(all), ...scriptSources(all)].join(" ");
		assert.equal(/'https?:/.test(text), false);
	});

	it("astroCsp ha direttive e sorgenti degli script", () => {
		const csp = astroCsp(cfg());
		assert.ok(csp.directives.length >= 7);
		assert.deepEqual(csp.scriptDirective.resources, ["'self'"]);
	});

	it("riconosce gli host riservati", () => {
		for (const bad of [
			"https://form.invalid/x",
			"https://x.example/f",
			"https://a.test/",
			"https://localhost/f",
			"https://sub.example/f",
			"https://sub.example.:8443/f",
			"https://localhost./f",
		]) {
			assert.equal(isReservedHost(bad), true, bad);
		}
		for (const good of [
			"https://moduli.esempio.it/f",
			"/api/richiesta",
			"https://example.com.evil.it/f",
		]) {
			assert.equal(isReservedHost(good), false, good);
		}
	});
});

describe("_headers", () => {
	const text = securityHeaders();
	const headers = parseHeadersFile(text);

	it("X-Robots-Tag noindex si applica a tutte le risorse dei siti block", () => {
		assert.equal(headers["X-Robots-Tag"], undefined);
		assert.equal(
			parseHeadersFile(securityHeaders("block"))["X-Robots-Tag"],
			"noindex",
		);
	});

	it("ha tutte le intestazioni obbligatorie con i valori decisi in 04", () => {
		for (const name of REQUIRED_HEADERS) assert.ok(headers[name], name);
		assert.equal(headers["Strict-Transport-Security"], "max-age=31536000");
		assert.equal(headers["X-Content-Type-Options"], "nosniff");
		assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
		assert.equal(
			headers["Permissions-Policy"],
			"camera=(), microphone=(), geolocation=()",
		);
	});

	it("la CSP dell'intestazione ha frame-ancestors e MAI script-src (bloccherebbe gli script con gli hash)", () => {
		const csp = headers["Content-Security-Policy"] ?? "";
		assert.match(csp, /frame-ancestors 'none'/);
		assert.equal(/script-src|default-src|style-src/.test(csp), false);
	});

	it("HSTS senza includeSubDomains né preload", () => {
		assert.equal(/includeSubDomains|preload/i.test(text), false);
	});

	it("il file rispetta i limiti di Cloudflare (righe sotto 2000 caratteri, meno di 100 regole)", () => {
		assert.ok(text.split("\n").every((line) => line.length < 2000));
		assert.ok(
			text.split("\n").filter((line) => line.startsWith("/")).length < 100,
		);
	});
});
