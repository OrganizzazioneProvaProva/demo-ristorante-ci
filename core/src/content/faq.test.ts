import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import { resolveFaq } from "./faq.ts";

const config = parseSiteConfig({
	slug: "t",
	schemaVersion: 1,
	languages: ["it", "en"],
});

const faq = {
	title: { it: "Prima di venire", en: "Before you come" },
	subtitle: { it: "Orari, prenotazioni e altro." },
	items: [
		{
			question: { it: "Serve prenotare?", en: "Do I need to book?" },
			answer: {
				it: "Consigliato nel fine settimana.",
				en: "Recommended at weekends.",
			},
		},
		{
			question: { it: "Avete il parcheggio?", en: "Is there parking?" },
			answer: { it: "Sì, davanti al locale." },
		},
	],
};

describe("domande frequenti", () => {
	it("nella lingua: titoli, domande e risposte", () => {
		const it_ = resolveFaq(faq, "it", config);
		assert.equal(it_?.title, "Prima di venire");
		assert.equal(it_?.subtitle, "Orari, prenotazioni e altro.");
		assert.equal(it_?.items.length, 2);
	});

	it("senza ripiego: una voce senza traduzione non compare in inglese, e il sottotitolo manca", () => {
		const en = resolveFaq(faq, "en", config);
		assert.equal(en?.items.length, 1);
		assert.equal(en?.items[0]?.question, "Do I need to book?");
		assert.equal(en?.subtitle, undefined);
	});

	it("una voce incompleta nella lingua principale ferma la build", () => {
		assert.throws(
			() =>
				resolveFaq(
					{ items: [{ question: { it: "Solo domanda" }, answer: {} }] },
					"it",
					config,
				),
			/voce 1.*si ferma/,
		);
	});

	it("senza voci nella lingua la sezione non esiste", () => {
		assert.equal(resolveFaq({ items: [] }, "it", config), undefined);
		assert.equal(
			resolveFaq(
				{ items: [{ question: { it: "a" }, answer: { it: "b" } }] },
				"en",
				config,
			),
			undefined,
		);
	});

	it("rifiuta più di 20 voci", () => {
		const items = Array.from({ length: 21 }, () => ({
			question: { it: "a" },
			answer: { it: "b" },
		}));
		assert.throws(() => resolveFaq({ items }, "it", config));
	});
});
