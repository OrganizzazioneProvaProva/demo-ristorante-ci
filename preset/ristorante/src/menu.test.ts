import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import { ALLERGENS as STUDIO_ALLERGENS } from "../studio/src/allergens.ts";
import { CUISINES as STUDIO_CUISINES } from "../studio/src/cuisines.ts";
import { ALLERGENS, ASK_STAFF_NOTICE, allergenLabel } from "./allergens.ts";
import { CUISINES } from "./cuisines.ts";
import {
	featuredItems,
	formatPrice,
	rawMenuSchema,
	resolveMenu,
	slugify,
} from "./menu.ts";

const config = parseSiteConfig({
	slug: "t",
	schemaVersion: 1,
	languages: ["it", "en"],
});
const photo =
	"https://cdn.sanity.io/images/a9fpp237/production/abc-800x600.jpg";

const menu = {
	sections: [
		{
			title: { it: "Pizze", en: "Pizzas" },
			items: [
				{
					name: "Margherita",
					description: {
						it: "Pomodoro e fior di latte.",
						en: "Tomato and mozzarella.",
					},
					price: 7,
					allergens: ["gluten", "milk"],
					allergensVerified: true,
					diet: "vegetarian",
					featured: true,
				},
				{
					name: "Diavola",
					price: 9,
					allergens: ["gluten", "milk"],
					allergensVerified: false,
				},
				{ name: "Marinara", price: 6, allergens: [], allergensVerified: true },
			],
		},
		{ title: { it: "Dolci" }, items: [{ name: "Cannolo", price: 5.5 }] },
	],
};

describe("allergeni", () => {
	it("sono i 14 del Reg. UE 1169/2011, con etichette IT ed EN", () => {
		assert.equal(ALLERGENS.length, 14);
		assert.equal(
			allergenLabel("sulphites", "en"),
			"Sulphur dioxide and sulphites",
		);
		assert.equal(allergenLabel("tree-nuts", "it"), "Frutta a guscio");
	});

	it("i codici e i nomi italiani coincidono con quelli dello Studio, nello stesso ordine", () => {
		assert.deepEqual(
			ALLERGENS.map((a) => [a.code, a.it]),
			STUDIO_ALLERGENS.map((a) => [a.value, a.title]),
		);
	});

	it("i tipi di cucina del sito e dello Studio sono gli stessi (valore e nome italiano)", () => {
		assert.deepEqual(
			CUISINES.map((c) => [c.value, c.it]),
			STUDIO_CUISINES.map((c) => [c.value, c.title]),
		);
	});

	it("c'è un invito in italiano e in inglese per gli allergeni non verificati", () => {
		assert.match(ASK_STAFF_NOTICE.it, /personale/);
		assert.match(ASK_STAFF_NOTICE.en, /staff/);
	});
});

describe("menu", () => {
	it("mostra gli allergeni solo se verificati; altrimenti invita a chiedere", () => {
		const items = resolveMenu(menu, "it", config).sections[0]?.items ?? [];
		assert.deepEqual(items[0]?.allergens, {
			status: "listed",
			allergens: [
				{ code: "gluten", label: "Cereali contenenti glutine" },
				{ code: "milk", label: "Latte e lattosio" },
			],
		});
		assert.deepEqual(items[1]?.allergens, { status: "ask-staff" });
		assert.deepEqual(items[2]?.allergens, { status: "none" });
		// piatto senza nessun dato sugli allergeni: mai "nessun allergene"
		const dolci = resolveMenu(menu, "it", config).sections[1]?.items[0];
		assert.deepEqual(dolci?.allergens, { status: "ask-staff" });
	});

	it("in inglese usa i nomi inglesi, la descrizione inglese e il titolo inglese", () => {
		const pizzas = resolveMenu(menu, "en", config).sections[0];
		assert.equal(pizzas?.title, "Pizzas");
		assert.equal(pizzas?.items[0]?.description, "Tomato and mozzarella.");
		const info = pizzas?.items[0]?.allergens;
		assert.equal(info?.status, "listed");
		if (info?.status === "listed") {
			assert.equal(info.allergens[0]?.label, "Cereals containing gluten");
		}
	});

	it("una sezione senza titolo inglese non compare in inglese e viene segnalata", () => {
		const en = resolveMenu(menu, "en", config);
		assert.deepEqual(
			en.sections.map((c) => c.title),
			["Pizzas"],
		);
		assert.deepEqual(en.skipped, [
			{ index: 1, language: "en", missing: "title" },
		]);
	});

	describe("gruppi annidati (più menu)", () => {
		const item = { name: "Margherita", price: 7 };
		const section = (it: string, en?: string) => ({
			title: { it, ...(en ? { en } : {}) },
			items: [item],
		});
		const grouped = {
			groups: [
				{
					title: { it: "Pizzeria", en: "Pizzeria" },
					sections: [
						section("Pizze", "Pizzas"),
						section("Calzoni", "Calzones"),
					],
				},
				{
					title: { it: "Ristorante", en: "Restaurant" },
					sections: [section("Primi", "First courses")],
				},
			],
		};

		it("senza gruppi il menu è uno solo: un gruppo senza titolo né ancora", () => {
			const { groups, sections } = resolveMenu(menu, "it", config);
			assert.equal(groups.length, 1);
			assert.equal(groups[0]?.title, undefined);
			assert.equal(groups[0]?.id, undefined);
			assert.equal(sections.length, groups[0]?.sections.length);
		});

		it("con i gruppi restituisce titolo, ancora e sezioni di ogni gruppo, nella lingua", () => {
			const it = resolveMenu(grouped, "it", config);
			assert.deepEqual(
				it.groups.map((g) => [g.id, g.title, g.sections.map((c) => c.title)]),
				[
					["pizzeria", "Pizzeria", ["Pizze", "Calzoni"]],
					["ristorante", "Ristorante", ["Primi"]],
				],
			);
			const en = resolveMenu(grouped, "en", config);
			assert.deepEqual(
				en.groups.map((g) => [g.id, g.title]),
				[
					["pizzeria", "Pizzeria"],
					["ristorante", "Restaurant"],
				],
			);
		});

		it("le ancore vengono dal nome nella lingua principale, quindi sono uguali in ogni lingua", () => {
			const ids = (language: "it" | "en") =>
				resolveMenu(grouped, language, config).sections.map((c) => c.id);
			assert.deepEqual(ids("it"), ["pizze", "calzoni", "primi"]);
			assert.deepEqual(ids("en"), ids("it"));
		});

		it("nomi uguali non danno ancore uguali; accenti e apostrofi diventano trattini", () => {
			const twin = {
				sections: [
					section("Dolci"),
					section("Dolci"),
					section("Caffè e Amari"),
				],
			};
			assert.deepEqual(
				resolveMenu(twin, "it", config).sections.map((c) => c.id),
				["dolci", "dolci-2", "caffe-e-amari"],
			);
			assert.equal(slugify("Un'Entrée à la carte!"), "un-entree-a-la-carte");
		});

		it("un gruppo senza nome inglese non compare in inglese, con le sue sezioni, e viene segnalato", () => {
			const raw = {
				groups: [
					{ ...grouped.groups[0], title: { it: "Pizzeria" } },
					grouped.groups[1],
				],
			};
			const en = resolveMenu(raw, "en", config);
			assert.deepEqual(
				en.groups.map((g) => g.title),
				["Restaurant"],
			);
			assert.deepEqual(en.skipped, [
				{ groupIndex: 0, language: "en", missing: "groupTitle" },
			]);
		});

		it("una sezione senza nome inglese dentro un gruppo salta solo quella, con la posizione del gruppo", () => {
			const raw = {
				groups: [
					{
						title: { it: "Pizzeria", en: "Pizzeria" },
						sections: [section("Pizze", "Pizzas"), section("Calzoni")],
					},
				],
			};
			const en = resolveMenu(raw, "en", config);
			assert.deepEqual(
				en.groups[0]?.sections.map((c) => c.title),
				["Pizzas"],
			);
			assert.deepEqual(en.skipped, [
				{ index: 1, groupIndex: 0, language: "en", missing: "title" },
			]);
		});

		it("un gruppo che resta senza sezioni in una lingua sparisce", () => {
			const raw = {
				groups: [
					{
						title: { it: "Pizzeria", en: "Pizzeria" },
						sections: [section("Pizze")],
					},
				],
			};
			assert.deepEqual(resolveMenu(raw, "en", config).groups, []);
		});

		it("menu distinto senza nome nella lingua principale ferma la build", () => {
			const raw = {
				groups: [{ ...grouped.groups[0], title: { en: "Pizzeria" } }],
			};
			assert.throws(
				() => resolveMenu(raw, "it", config),
				/Menu #1.*lingua principale/,
			);
		});

		it("un menu vuoto ferma la build (serve almeno una sezione)", () => {
			assert.throws(() => resolveMenu({}, "it", config), /vuoto/);
			assert.throws(() => resolveMenu({ groups: [] }, "it", config), /vuoto/);
		});
	});

	describe("passare da un menu a più menu senza spostare i piatti", () => {
		const pizzas = [
			{
				title: { it: "Pizze", en: "Pizzas" },
				items: [{ name: "Margherita", price: 7 }],
			},
		];
		const restaurant = {
			title: { it: "Ristorante", en: "Restaurant" },
			sections: [
				{
					title: { it: "Primi", en: "First courses" },
					items: [{ name: "Tagliolini", price: 14 }],
				},
			],
		};

		it("1) un menu solo: le sezioni dirette, nessun titolo", () => {
			const { groups } = resolveMenu({ sections: pizzas }, "it", config);
			assert.equal(groups.length, 1);
			assert.equal(groups[0]?.title, undefined);
		});

		it("2) si dà un nome al primo menu e si aggiunge il secondo: le sezioni dirette restano dove sono", () => {
			const before = { sections: pizzas };
			const after = {
				sections: pizzas,
				mainTitle: { it: "Pizzeria", en: "Pizzeria" },
				groups: [restaurant],
			};
			const a = resolveMenu(before, "it", config);
			const b = resolveMenu(after, "it", config);
			assert.deepEqual(
				b.groups.map((g) => [g.id, g.title, g.sections.map((c) => c.title)]),
				[
					["pizzeria", "Pizzeria", ["Pizze"]],
					["ristorante", "Ristorante", ["Primi"]],
				],
			);
			// i piatti del primo menu sono gli stessi di prima
			assert.deepEqual(
				b.groups[0]?.sections[0]?.items,
				a.groups[0]?.sections[0]?.items,
			);
			assert.equal(
				resolveMenu(after, "en", config).groups[1]?.title,
				"Restaurant",
			);
		});

		it("3) con più menu il primo deve avere un nome, altrimenti la build si ferma", () => {
			assert.throws(
				() =>
					resolveMenu({ sections: pizzas, groups: [restaurant] }, "it", config),
				/serve il nome anche del primo/,
			);
		});

		it("4) un primo menu con il nome solo in italiano non compare in inglese e viene segnalato", () => {
			const raw = {
				sections: pizzas,
				mainTitle: { it: "Pizzeria" },
				groups: [restaurant],
			};
			const en = resolveMenu(raw, "en", config);
			assert.deepEqual(
				en.groups.map((g) => g.title),
				["Restaurant"],
			);
			assert.deepEqual(en.skipped, [
				{ groupIndex: 0, language: "en", missing: "groupTitle" },
			]);
		});

		it("5) solo menu distinti, senza sezioni dirette, funziona come prima", () => {
			const { groups } = resolveMenu({ groups: [restaurant] }, "it", config);
			assert.deepEqual(
				groups.map((g) => g.title),
				["Ristorante"],
			);
		});

		it("un menu solo con un nome (mainTitle) lo mostra come titolo", () => {
			const { groups } = resolveMenu(
				{
					sections: pizzas,
					mainTitle: { it: "Il nostro menu", en: "Our menu" },
				},
				"en",
				config,
			);
			assert.equal(groups[0]?.title, "Our menu");
			assert.equal(groups[0]?.id, "il-nostro-menu");
		});
	});

	it("una descrizione mancante in inglese resta vuota (nessun ripiego sull'italiano)", () => {
		assert.equal(
			resolveMenu(menu, "en", config).sections[0]?.items[1]?.description,
			undefined,
		);
	});

	it("senza nome italiano della sezione la build si ferma", () => {
		const bad = { sections: [{ title: { en: "Pizzas" }, items: [] }] };
		assert.throws(() => resolveMenu(bad, "it", config), /lingua principale/);
	});

	it("rifiuta prezzi negativi o con più di due decimali, e allergeni sconosciuti", () => {
		const item = (over: object) => ({
			sections: [
				{
					title: { it: "X", en: "X" },
					items: [{ name: "P", price: 5, ...over }],
				},
			],
		});
		assert.ok(rawMenuSchema.safeParse(item({})).success);
		assert.ok(rawMenuSchema.safeParse(item({ price: 5.1 })).success);
		assert.ok(!rawMenuSchema.safeParse(item({ price: -1 })).success);
		assert.ok(!rawMenuSchema.safeParse(item({ price: 5.123 })).success);
		assert.ok(
			!rawMenuSchema.safeParse(item({ allergens: ["arachidi"] })).success,
		);
	});

	it("la foto del piatto ha il testo alternativo oppure blocca la build", () => {
		const withPhoto = (photoData: object) => ({
			sections: [
				{
					title: { it: "X", en: "X" },
					items: [{ name: "P", price: 5, photo: photoData }],
				},
			],
		});
		assert.throws(
			() => resolveMenu(withPhoto({ asset: { url: photo } }), "it", config),
			/testo alternativo/,
		);
		const ok = resolveMenu(
			withPhoto({ asset: { url: photo }, alt: { it: "Una margherita" } }),
			"it",
			config,
		);
		assert.equal(ok.sections[0]?.items[0]?.photo?.alt, "Una margherita");
		const english = resolveMenu(
			withPhoto({ asset: { url: photo }, alt: { it: "Una margherita" } }),
			"en",
			config,
		);
		const enPhoto = english.sections[0]?.items[0]?.photo;
		assert.equal(enPhoto?.alt, "Una margherita");
		assert.equal(enPhoto?.lang, "it");
	});

	it("elenca i piatti in evidenza", () => {
		const { sections } = resolveMenu(menu, "it", config);
		assert.deepEqual(
			featuredItems(sections).map((d) => d.name),
			["Margherita"],
		);
	});

	it("formatta il prezzo in euro nella lingua", () => {
		assert.match(formatPrice(8.5, "it"), /8,50/);
		assert.match(formatPrice(8.5, "en"), /8\.50/);
	});
});

describe("tipi di cucina", () => {
	const oneSection = {
		sections: [
			{ title: { it: "Pizze" }, items: [{ name: "Margherita", price: 7 }] },
		],
	};

	it("passano nell'ordine scelto; senza, l'elenco è vuoto", () => {
		assert.deepEqual(
			resolveMenu(
				{ ...oneSection, cuisine: ["Sicilian", "Pizza"] },
				"it",
				config,
			).cuisine,
			["Sicilian", "Pizza"],
		);
		assert.deepEqual(resolveMenu(oneSection, "it", config).cuisine, []);
	});

	it("sono uguali in ogni lingua (valori di schema.org, non testi tradotti)", () => {
		const raw = {
			...oneSection,
			sections: [{ title: { it: "Pizze", en: "Pizzas" }, items: [] }],
			cuisine: ["Pizza"],
		};
		assert.deepEqual(resolveMenu(raw, "en", config).cuisine, ["Pizza"]);
	});

	it("rifiuta valori sconosciuti, doppioni e più di 5", () => {
		assert.throws(() =>
			resolveMenu({ ...oneSection, cuisine: ["pizzeria"] }, "it", config),
		);
		assert.throws(
			() =>
				resolveMenu(
					{ ...oneSection, cuisine: ["Pizza", "Pizza"] },
					"it",
					config,
				),
			/ripetuti/,
		);
		assert.throws(() =>
			resolveMenu(
				{
					...oneSection,
					cuisine: ["Italian", "Pizza", "Sicilian", "Seafood", "Vegan", "Cafe"],
				},
				"it",
				config,
			),
		);
	});
});

describe("componenti della voce", () => {
	const withComponents = {
		sections: [
			{
				title: { it: "Primi", en: "First courses" },
				items: [
					{
						name: "Norma",
						price: 13,
						components: [
							{ it: "Pomodoro", en: "Tomato" },
							{ it: "Ricotta salata" },
							{ it: "  ", en: "  " },
						],
					},
					{ name: "Senza", price: 5 },
				],
			},
		],
	};

	it("compaiono nella lingua, senza ripiego e senza voci vuote", () => {
		const first = (language: "it" | "en") =>
			resolveMenu(withComponents, language, config).sections[0]?.items;
		assert.deepEqual(first("it")?.[0]?.components, [
			"Pomodoro",
			"Ricotta salata",
		]);
		assert.deepEqual(first("en")?.[0]?.components, ["Tomato"]);
	});

	it("sono facoltativi: senza, l'elenco è vuoto", () => {
		const items = resolveMenu(withComponents, "it", config).sections[0]?.items;
		assert.deepEqual(items?.[1]?.components, []);
	});
});
