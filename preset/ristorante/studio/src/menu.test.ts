import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sitiStudioCore } from "@siti/studio-core";
import { createSchema, type SchemaTypeDefinition } from "sanity";
import { ALLERGENS } from "./allergens.ts";
import { RISTORANTE_SINGLETON_TYPES, sitiStudioRistorante } from "./index.ts";
import {
	formatPrice,
	itemType,
	menuGroupType,
	menuSectionType,
	menuType,
} from "./menu.ts";

interface FieldLike {
	name: string;
	validation?: unknown;
	options?: { list?: Array<{ value: string }> };
	type?: { name: string } | string;
}
const fieldsOf = (type: unknown): FieldLike[] =>
	(type as { fields: FieldLike[] }).fields;
const field = (type: unknown, name: string): FieldLike => {
	const found = fieldsOf(type).find((f) => f.name === name);
	assert.ok(found, `campo "${name}" mancante`);
	return found;
};

function record(validation: unknown) {
	assert.equal(typeof validation, "function");
	const calls: Array<{ name: string; args: unknown[] }> = [];
	const rule: unknown = new Proxy(
		{},
		{
			get:
				(_t, name: string) =>
				(...args: unknown[]) => {
					calls.push({ name, args });
					return rule;
				},
		},
	);
	(validation as (rule: never) => unknown)(rule as never);
	return calls;
}

describe("allergeni", () => {
	it("sono i 14 dell'Allegato II del Reg. UE 1169/2011, con codici unici", () => {
		assert.equal(ALLERGENS.length, 14);
		assert.equal(new Set(ALLERGENS.map((a) => a.value)).size, 14);
		assert.ok(ALLERGENS.every((a) => a.title.length > 0));
		assert.equal(ALLERGENS[0]?.value, "gluten");
		assert.equal(ALLERGENS[13]?.value, "molluscs");
	});

	it("il campo del piatto offre esattamente quei 14 e non ammette doppioni", () => {
		const allergens = field(itemType, "allergens");
		assert.deepEqual(
			allergens.options?.list?.map((a) => a.value),
			ALLERGENS.map((a) => a.value),
		);
		assert.ok(record(allergens.validation).some((c) => c.name === "unique"));
	});

	it("allergeni indicati ma non verificati generano un avviso", () => {
		const verified = field(itemType, "allergensVerified");
		const calls = record(verified.validation);
		assert.deepEqual(
			calls.map((c) => c.name),
			["custom", "warning"],
		);
		const check = calls[0]?.args[0] as (
			value: unknown,
			context: { parent: unknown },
		) => true | string;
		assert.match(
			String(check(false, { parent: { allergens: ["milk"] } })),
			/verificati/,
		);
		assert.equal(check(true, { parent: { allergens: ["milk"] } }), true);
		assert.equal(check(false, { parent: { allergens: [] } }), true);
		assert.equal(check(false, { parent: {} }), true);
	});
});

describe("componenti della voce", () => {
	it("sono un elenco facoltativo di testi per lingua, al massimo 30", () => {
		const components = field(itemType, "components");
		assert.equal(
			(components as unknown as { of: Array<{ type: string }> }).of[0]?.type,
			"localeString",
		);
		const calls = record(components.validation);
		assert.equal(
			calls.some((c) => c.name === "required"),
			false,
		);
		assert.deepEqual(calls.find((c) => c.name === "max")?.args, [30]);
	});
});

describe("piatto e menu", () => {
	it("nome e prezzo sono obbligatori; il prezzo non è negativo e ha due decimali", () => {
		assert.ok(
			record(field(itemType, "name").validation).some(
				(c) => c.name === "required",
			),
		);
		assert.deepEqual(
			record(field(itemType, "price").validation).map((c) => c.name),
			["required", "min", "precision"],
		);
	});

	it("sezioni e piatti: almeno uno", () => {
		assert.deepEqual(
			record(field(menuSectionType, "items").validation).map((c) => c.name),
			["required", "min"],
		);
		assert.deepEqual(
			record(field(menuGroupType, "sections").validation).map((c) => c.name),
			["required", "min"],
		);
	});

	it("la sezione non ha più il campo group (sostituito dai menu distinti)", () => {
		assert.ok(
			!(menuSectionType as { fields: Array<{ name: string }> }).fields.some(
				(f) => f.name === "group",
			),
		);
	});

	it("il menu principale ha un nome facoltativo per lingua e gli altri menu sono un elenco", () => {
		const mainTitle = field(menuType, "mainTitle");
		assert.equal(mainTitle.validation, undefined);
		assert.equal(
			typeof mainTitle.type === "string"
				? mainTitle.type
				: mainTitle.type?.name,
			"localeString",
		);
		assert.deepEqual(
			(menuType as { fields: Array<{ name: string }> }).fields.map(
				(f) => f.name,
			),
			["sections", "mainTitle", "cuisine", "groups"],
		);
	});

	it("il tipo di cucina è un elenco di valori di schema.org (inglesi), unico e fino a 5", () => {
		const cuisine = field(menuType, "cuisine");
		assert.deepEqual(
			record(cuisine.validation).map((c) => c.name),
			["unique", "max"],
		);
		const values = (cuisine.options?.list ?? []).map((item) => item.value);
		assert.ok(values.includes("Pizza") && values.includes("Sicilian"));
		assert.ok(values.every((value) => /^[A-Z][A-Za-z ]+$/.test(value)));
	});

	it("il menu distinto ha titolo per lingua obbligatorio e almeno una sezione", () => {
		assert.equal(
			(field(menuGroupType, "title").type as { name?: string } | string) ===
				"localeString" ||
				(field(menuGroupType, "title").type as { name?: string }).name ===
					"localeString",
			true,
		);
		assert.deepEqual(
			record(field(menuGroupType, "title").validation).map((c) => c.name),
			["required"],
		);
	});

	it("il prezzo si mostra in euro", () => {
		assert.match(formatPrice(8.5), /8,50/);
		assert.equal(formatPrice(undefined), "prezzo mancante");
	});

	it("il menu è un documento singolo", () => {
		assert.deepEqual([...RISTORANTE_SINGLETON_TYPES], ["menu"]);
	});
});

describe("core + preset insieme", () => {
	it("gli schemi compilano senza errori di validazione, con una o due lingue", () => {
		for (const languages of [["it"], ["it", "en"]] as const) {
			const core = sitiStudioCore({ languages, defaultLanguage: "it" });
			const preset = sitiStudioRistorante();
			const coreTypes = core.schema?.types as SchemaTypeDefinition[];
			const presetTypes = preset.schema?.types as SchemaTypeDefinition[];
			const schema = createSchema({
				name: "default",
				types: [...coreTypes, ...presetTypes],
			});
			const validation = (
				schema as unknown as {
					_validation: Array<{
						problems: Array<{ severity: string; message: string }>;
					}>;
				}
			)._validation;
			const errors = validation
				.flatMap((entry) => entry.problems)
				.filter((problem) => problem.severity === "error");
			assert.deepEqual(errors, [], languages.join("+"));
			assert.ok(schema.get("menu"));
			assert.ok(schema.get("item"));
		}
	});
});
