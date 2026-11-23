import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSocialUrl, whatsappDigits, whatsappUrl } from "./social.ts";

describe("profili social", () => {
	it("accetta solo https sull'host del servizio", () => {
		assert.ok(isSocialUrl("instagram", "https://www.instagram.com/locale"));
		assert.ok(isSocialUrl("facebook", "https://facebook.com/locale"));
		assert.ok(isSocialUrl("tiktok", "https://www.tiktok.com/@locale"));
	});

	it("rifiuta altri host, http, credenziali nell'URL e servizi scambiati", () => {
		for (const [kind, url] of [
			["instagram", "http://www.instagram.com/x"],
			["instagram", "https://evil.example/instagram.com"],
			["instagram", "https://instagram.com.evil.example/x"],
			["instagram", "https://user:pw@instagram.com/x"],
			["instagram", "https://www.facebook.com/x"],
			["tiktok", "javascript:alert(1)"],
			["facebook", "non un url"],
		] as const) {
			assert.equal(isSocialUrl(kind, url), false, url);
		}
	});
});

describe("WhatsApp", () => {
	it("dal numero internazionale al link wa.me", () => {
		assert.equal(whatsappDigits("+39 333 123 4567"), "393331234567");
		assert.equal(whatsappUrl("+39 333 123 4567"), "https://wa.me/393331234567");
		assert.equal(
			whatsappUrl("+44 (20) 7946-0958"),
			"https://wa.me/442079460958",
		);
	});

	it("rifiuta numeri senza + e prefisso, troppo corti o con lettere", () => {
		for (const value of [
			"333 123 4567",
			"+39",
			"+39 abc",
			"",
			"+1234567890123456",
		]) {
			assert.equal(whatsappUrl(value), undefined, value);
		}
	});
});
