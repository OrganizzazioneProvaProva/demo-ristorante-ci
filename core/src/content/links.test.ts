import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSiteLink } from "./links.ts";

describe("isSiteLink", () => {
	it("ammette percorsi locali, frammenti ed escape percentuali", () => {
		for (const link of ["/", "/privacy/", "/contatti/#prenota", "/%5Cx"]) {
			assert.equal(isSiteLink(link), true, JSON.stringify(link));
		}
	});

	it("rifiuta percorsi ambigui, spazi e caratteri di controllo", () => {
		for (const link of [
			"/\\evil.com",
			"/\t/evil.com",
			"/\n/evil.com",
			"//evil.com",
			"/ evil",
			"/\u0000x",
			"/\u0085x",
			"",
			"javascript:void 0",
		]) {
			assert.equal(isSiteLink(link), false, JSON.stringify(link));
		}
	});
});
