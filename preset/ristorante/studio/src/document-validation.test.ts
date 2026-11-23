// Prove con il VALIDATORE VERO di Sanity sul menu (vedi studio/core/src/document-validation.test.ts).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateDocument } from "@sanity/validation";
import { sitiStudioCore } from "@siti/studio-core";
import { createSchema, type SchemaTypeDefinition } from "sanity";
import { sitiStudioRistorante } from "./index.ts";

const client = {
	fetch: async () => [],
	getDataUrl: () => "",
	request: async () => ({}),
	observable: {
		fetch: () => {
			throw new Error("non disponibile offline");
		},
	},
	withConfig() {
		return client;
	},
};

function typesOf(plugin: {
	schema?: { types?: unknown };
}): SchemaTypeDefinition[] {
	const types = plugin.schema?.types;
	assert.ok(
		Array.isArray(types),
		"il plugin deve registrare un elenco di tipi",
	);
	return types as SchemaTypeDefinition[];
}

const types = [
	...typesOf(
		sitiStudioCore({ languages: ["it", "en"], defaultLanguage: "it" }),
	),
	...typesOf(sitiStudioRistorante()),
];
const schema = createSchema({ name: "default", types });

type Marker = { level: string; path: unknown[] };
const pathOf = (marker: Marker) =>
	marker.path
		.map((s) =>
			typeof s === "object" && s !== null && "_key" in s
				? `[${(s as { _key: string })._key}]`
				: String(s),
		)
		.join(".");

async function validate(item: Record<string, unknown>) {
	const result = await validateDocument({
		document: {
			_id: "menu",
			_type: "menu",
			_createdAt: "2026-11-18T10:00:00Z",
			_updatedAt: "2026-11-18T10:00:00Z",
			_rev: "rev1",
			sections: [
				{
					_type: "menuSection",
					_key: "c",
					title: { it: "Pizze" },
					items: [{ _type: "item", _key: "d", ...item }],
				},
			],
		} as never,
		schema,
		client: client as never,
		getDocumentExists: async () => true,
		validateReferenceTypes: false,
	});
	assert.equal(result.complete, true);
	const markers = result.markers as Marker[];
	return {
		errors: markers.filter((m) => m.level === "error").map(pathOf),
		warnings: markers.filter((m) => m.level === "warning").map(pathOf),
	};
}

const base = { name: "Margherita", price: 8.5 };
const at = (field: string) => `sections.[c].items.[d].${field}`;

describe("piatto nel validatore vero di Sanity", () => {
	it("nome e prezzo bastano: descrizione, foto e allergeni sono facoltativi", async () => {
		assert.deepEqual((await validate(base)).errors, []);
	});

	it("una foto senza file non richiede l'alt, anche se Studio ha salvato il campo", async () => {
		const photo = { _type: "siteImage", decorative: false };
		for (const value of [photo, { ...photo, alt: { en: "Espresso" } }]) {
			const result = await validate({ ...base, photo: value });
			assert.deepEqual(result.errors, []);
			assert.ok(
				!result.warnings.some((field) => field.startsWith(at("photo"))),
			);
		}
	});

	it("senza prezzo o con prezzo negativo non si può pubblicare", async () => {
		assert.ok(
			(await validate({ name: "Margherita" })).errors.includes(at("price")),
		);
		assert.ok(
			(await validate({ ...base, price: -1 })).errors.includes(at("price")),
		);
	});

	it("senza nome non si può pubblicare", async () => {
		assert.ok((await validate({ price: 5 })).errors.includes(at("name")));
	});

	it("allergeni indicati ma non verificati: avviso, non errore", async () => {
		const result = await validate({ ...base, allergens: ["milk", "gluten"] });
		assert.deepEqual(result.errors, []);
		assert.ok(result.warnings.includes(at("allergensVerified")));
	});

	it("allergeni verificati: nessun avviso", async () => {
		const result = await validate({
			...base,
			allergens: ["milk"],
			allergensVerified: true,
		});
		assert.deepEqual(result.errors, []);
		assert.ok(!result.warnings.includes(at("allergensVerified")));
	});

	it("la foto di un piatto senza testo alternativo (non decorativa) è un errore", async () => {
		const photo = {
			_type: "siteImage",
			asset: { _type: "reference", _ref: "image-abc123-800x600-jpg" },
			decorative: false,
		};
		assert.ok(
			(await validate({ ...base, photo })).errors.includes(at("photo.alt.it")),
		);
		assert.deepEqual(
			(
				await validate({
					...base,
					photo: { ...photo, alt: { it: "Una margherita appena sfornata" } },
				})
			).errors,
			[],
		);
	});

	it("il toggle spento esclude la foto salvata dalla validazione dell'alt", async () => {
		const photo = {
			_type: "siteImage",
			asset: { _type: "reference", _ref: "image-abc123-800x600-jpg" },
			alt: { en: "An espresso" },
		};
		const off = await validate({ ...base, photoEnabled: false, photo });
		assert.deepEqual(off.errors, []);
		assert.ok(!off.warnings.some((field) => field.startsWith(at("photo"))));
		const on = await validate({ ...base, photoEnabled: true, photo });
		assert.ok(on.errors.includes(at("photo.alt.it")));
	});
});

describe("più menu (validatore vero di Sanity)", () => {
	const section = {
		_key: "c1",
		_type: "menuSection",
		title: { it: "Pizze", en: "Pizzas" },
		items: [{ _key: "d1", _type: "item", name: "Margherita", price: 7 }],
	};
	const group = {
		_key: "g1",
		_type: "menuGroup",
		title: { it: "Ristorante", en: "Restaurant" },
		sections: [section],
	};

	async function validateMenu(extra: Record<string, unknown>) {
		const result = await validateDocument({
			document: {
				_id: "menu",
				_type: "menu",
				_createdAt: "2026-11-18T10:00:00Z",
				_updatedAt: "2026-11-18T10:00:00Z",
				_rev: "rev1",
				...extra,
			} as never,
			schema,
			client: client as never,
			getDocumentExists: async () => true,
			validateReferenceTypes: false,
		});
		return result.markers as Array<Marker & { message: string }>;
	}

	it("un menu solo (solo sezioni) è valido, senza avvisi", async () => {
		const markers = await validateMenu({ sections: [section] });
		assert.deepEqual(
			markers.map((m) => `${m.level}:${pathOf(m)}`),
			[],
		);
	});

	it("passando a più menu con il nome del primo e un secondo menu: valido, senza spostare nulla", async () => {
		const markers = await validateMenu({
			sections: [section],
			mainTitle: { it: "Pizzeria", en: "Pizzeria" },
			groups: [group],
		});
		assert.deepEqual(
			markers.map((m) => `${m.level}:${pathOf(m)}`),
			[],
		);
	});

	it("più menu senza il nome del primo: errore che dice cosa fare (come la build, che si ferma)", async () => {
		const markers = await validateMenu({
			sections: [section],
			groups: [group],
		});
		const marker = markers.find((m) => pathOf(m) === "groups");
		assert.equal(marker?.level, "error");
		assert.match(marker?.message ?? "", /Nome del menu principale/);
	});

	it("solo menu distinti, senza sezioni dirette: valido", async () => {
		const markers = await validateMenu({ groups: [group] });
		assert.deepEqual(
			markers.filter((m) => m.level === "error"),
			[],
		);
	});

	it("un menu senza sezioni né altri menu è un errore (come la build, che si ferma)", async () => {
		const markers = await validateMenu({});
		const marker = markers.find((m) => pathOf(m) === "sections");
		assert.equal(marker?.level, "error");
	});
});
