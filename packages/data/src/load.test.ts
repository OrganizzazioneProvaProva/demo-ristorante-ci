import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	loadContent,
	loadSiteContent,
	type QueryClient,
	sourceSettings,
} from "./load.ts";
import { CORE_QUERIES } from "./queries.ts";

const demo = { slug: "demo-ristorante", kind: "demo" } as const;
const real = { slug: "pizzeria-da-mario" };

describe("sorgente dei contenuti", () => {
	it("senza variabili usa i dati finti, ma solo nei siti prova e demo-*", () => {
		assert.deepEqual(sourceSettings({}, demo), {
			source: "fixtures",
		});
		assert.deepEqual(sourceSettings({}, { slug: "prova", kind: "demo" }), {
			source: "fixtures",
		});
		assert.throws(() => sourceSettings({}, real), /dati finti.*demo/);
		assert.throws(
			() => sourceSettings({ SITI_CONTENT: "fixtures" }, real),
			/dati finti/,
		);
	});

	it("i dati finti servono la dichiarazione `kind: demo` e lo slug giusto, non basta uno dei due", () => {
		assert.throws(() => sourceSettings({}, { slug: "demo-x" }), /dati finti/);
		assert.throws(() => sourceSettings({}, { slug: "prova" }), /dati finti/);
		assert.throws(
			() => sourceSettings({}, { slug: "pizzeria-da-mario", kind: "demo" }),
			/dati finti/,
		);
		assert.deepEqual(sourceSettings({}, { slug: "demo-x", kind: "demo" }), {
			source: "fixtures",
		});
	});

	it("con sanity servono progetto e dataset espliciti: niente ripiego", () => {
		assert.throws(
			() => sourceSettings({ SITI_CONTENT: "sanity" }, demo),
			/SANITY_PROJECT_ID/,
		);
		assert.throws(
			() =>
				sourceSettings(
					{ SITI_CONTENT: "sanity", SANITY_PROJECT_ID: "abc123" },
					demo,
				),
			/SANITY_DATASET/,
		);
		assert.throws(
			() =>
				sourceSettings(
					{
						SITI_CONTENT: "sanity",
						SANITY_PROJECT_ID: "AB C",
						SANITY_DATASET: "production",
					},
					demo,
				),
			/SANITY_PROJECT_ID/,
		);
		assert.deepEqual(
			sourceSettings(
				{
					SITI_CONTENT: "sanity",
					SANITY_PROJECT_ID: "abc123",
					SANITY_DATASET: "production",
				},
				real,
			),
			{ source: "sanity", projectId: "abc123", dataset: "production" },
		);
	});

	it("un valore sconosciuto di SITI_CONTENT ferma la build", () => {
		assert.throws(
			() => sourceSettings({ SITI_CONTENT: "sanitty" }, demo),
			/non valido/,
		);
	});
});

describe("caricatore", () => {
	const settings = {
		source: "sanity",
		projectId: "abc123",
		dataset: "production",
	} as const;
	const fixtures = { company: { name: "finto" } };

	/** Client finto: risponde in base al testo della query. */
	const clientWith = (
		answers: Record<string, unknown>,
	): QueryClient & { asked: string[] } => {
		const asked: string[] = [];
		return {
			asked,
			async fetch(query) {
				asked.push(query);
				for (const [needle, answer] of Object.entries(answers)) {
					if (query.includes(needle)) return answer;
				}
				return null;
			},
		};
	};

	it("compone le query del sito con quelle del preset e mantiene le fixture locali", async () => {
		const extraQueries = {
			items: { groq: '"customItems"', kind: "list" },
		} as const;
		const documents = { ...fixtures, items: [{ _id: "finto" }], notices: [] };
		const client = clientWith({
			'"companyInfo"': {},
			'"openingHours"': {},
			'"home"': {},
			'"notice"': [],
			'"testimonial"': [],
			'"promotion"': [],
			'"page"': [],
			'"customItems"': [{ _id: "letto" }],
		});
		const local = await loadSiteContent({
			env: {},
			site: demo,
			fixtures: documents,
			extraQueries,
			client,
		});
		assert.deepEqual(local.items, documents.items);
		assert.deepEqual(local.contacts, {});
		assert.deepEqual(client.asked, []);

		const published = await loadSiteContent({
			env: {
				SITI_CONTENT: "sanity",
				SANITY_PROJECT_ID: "abc123",
				SANITY_DATASET: "production",
			},
			site: real,
			fixtures: documents,
			extraQueries,
			client,
		});
		assert.deepEqual(published.items, [{ _id: "letto" }]);
		assert.deepEqual(published.contacts, {});
		assert.deepEqual(published.pages, []);
		assert.equal(client.asked.length, Object.keys(CORE_QUERIES).length + 1);
	});

	it("con i dati finti restituisce le fixture e non chiede nulla alla rete", async () => {
		const client = clientWith({});
		const result = await loadContent({
			settings: { source: "fixtures" },
			queries: CORE_QUERIES,
			fixtures,
			client,
		});
		assert.equal(result, fixtures);
		assert.equal(client.asked.length, 0);
	});

	it("con sanity legge ogni documento e restituisce i risultati grezzi", async () => {
		const client = clientWith({
			'"companyInfo"': { name: "Vera" },
			'"openingHours"': { monday: { closed: true } },
			'"home"': { heroTitle: { it: "x" } },
			'"notice"': [],
			'"testimonial"': [],
			'"promotion"': [{ _id: "p" }],
			'"page"': [{ _id: "a", slug: "menu" }],
		});
		const result = await loadContent({
			settings,
			queries: CORE_QUERIES,
			fixtures,
			client,
		});
		assert.deepEqual(result.company, { name: "Vera" });
		assert.deepEqual(result.promotions, [{ _id: "p" }]);
		assert.equal(result.gallery, null, "la galleria è facoltativa");
		assert.equal(result.contacts, null, "i contatti sono facoltativi");
		assert.equal(result.faq, null, "le domande frequenti sono facoltative");
		assert.equal(client.asked.length, Object.keys(CORE_QUERIES).length);
	});

	it("un documento obbligatorio assente ferma la build e dice quale", async () => {
		const client = clientWith({ '"companyInfo"': { name: "Vera" } });
		await assert.rejects(
			loadContent({ settings, queries: CORE_QUERIES, fixtures, client }),
			/documento "(hours|home)" non esiste/,
		);
	});

	it("un elenco che non è un elenco ferma la build", async () => {
		const client = clientWith({
			'"companyInfo"': {},
			'"openingHours"': {},
			'"home"': {},
			'"notice"': { oops: true },
		});
		await assert.rejects(
			loadContent({ settings, queries: CORE_QUERIES, fixtures, client }),
			/doveva restituire un elenco/,
		);
	});

	it("gli elenchi hanno un ordine fisso, altrimenti le build cambiano da sole", () => {
		for (const [name, query] of Object.entries(CORE_QUERIES)) {
			if (query.kind === "list") {
				assert.match(query.groq, /\| order\(_createdAt asc, _id asc\)/, name);
			}
		}
	});

	it("le query chiedono solo documenti pubblicati per id e non ripetono i campi", () => {
		for (const query of Object.values(CORE_QUERIES)) {
			assert.ok(
				query.groq.startsWith("*[_id ==") ||
					query.groq.startsWith("*[_type =="),
			);
		}
	});
});
