import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSchema, type SchemaTypeDefinition } from "sanity";
import { companyInfoType } from "./company-info.ts";
import { contactsType } from "./contacts.ts";
import { sitiStudioCore } from "./index.ts";
import {
	localeStringType,
	localeTextType,
	orderedLanguages,
} from "./locale.ts";

interface FieldLike {
	name: string;
	validation?: unknown;
	fields?: FieldLike[];
	type?: { name: string };
}

const fieldsOf = (type: unknown): FieldLike[] =>
	(type as { fields: FieldLike[] }).fields;

/** Finto "rule" di Sanity: registra le chiamate a catena (required, warning, regex...). */
function recordRule() {
	const calls: Array<{ name: string; args: unknown[] }> = [];
	const rule: unknown = new Proxy(
		{},
		{
			get:
				(_target, name: string) =>
				(...args: unknown[]) => {
					calls.push({ name, args });
					return rule;
				},
		},
	);
	return { rule, calls };
}

function runValidation(validation: unknown) {
	assert.equal(
		typeof validation,
		"function",
		"validation deve essere una funzione",
	);
	const { rule, calls } = recordRule();
	(validation as (rule: never) => unknown)(rule as never);
	return calls;
}

function typesOf(options: Parameters<typeof sitiStudioCore>[0]) {
	const types = sitiStudioCore(options).schema?.types;
	assert.ok(
		Array.isArray(types),
		"il plugin deve registrare un elenco di tipi",
	);
	return types as SchemaTypeDefinition[];
}

const bilingual = { languages: ["it", "en"], defaultLanguage: "it" } as const;
const monolingual = { languages: ["it"], defaultLanguage: "it" } as const;

describe("tipi per lingua", () => {
	it("crea un campo per ogni lingua attiva, con la lingua principale per prima", () => {
		assert.deepEqual(
			fieldsOf(localeStringType(bilingual)).map((field) => field.name),
			["it", "en"],
		);
		assert.deepEqual(
			orderedLanguages({ languages: ["en", "it"], defaultLanguage: "it" }),
			["it", "en"],
		);
	});

	it("un sito con la sola lingua italiana non ha campi inglesi", () => {
		assert.deepEqual(
			fieldsOf(localeStringType(monolingual)).map((field) => field.name),
			["it"],
		);
		assert.deepEqual(
			fieldsOf(localeTextType(monolingual)).map((field) => field.name),
			["it"],
		);
	});

	it("la lingua principale è obbligatoria (errore), le altre solo un avviso", () => {
		const [italian, english] = fieldsOf(localeStringType(bilingual));
		assert.deepEqual(
			runValidation(italian?.validation).map((call) => call.name),
			["required"],
		);
		assert.deepEqual(
			runValidation(english?.validation).map((call) => call.name),
			["custom", "warning"],
		);
	});
});

describe("plugin del core", () => {
	it("registra i tipi comuni e compila senza problemi di validazione dello schema", () => {
		const types = typesOf(bilingual);
		assert.deepEqual(
			types.map((type) => type.name),
			[
				"localeString",
				"localeText",
				"localeStringRequired",
				"localeTextRequired",
				"altText",
				"siteImage",
				"timeInterval",
				"openingDay",
				"closurePeriod",
				"companyInfo",
				"openingHours",
				"gallery",
				"contacts",
				"faqItem",
				"faq",
				"testimonial",
				"home",
				"promotion",
				"notice",
				"page",
			],
		);

		const schema = createSchema({ name: "default", types });
		const validation = (
			schema as unknown as {
				_validation: Array<{ problems: Array<{ severity: string }> }>;
			}
		)._validation;
		const errors = validation
			.flatMap((entry) => entry.problems)
			.filter((problem) => problem.severity === "error");
		assert.deepEqual(errors, []);
		assert.ok(schema.get("page"));
	});

	it("la pagina usa i tipi per lingua per titolo e descrizione", () => {
		const schema = createSchema({
			name: "default",
			types: typesOf(bilingual),
		});
		const fieldTypes = Object.fromEntries(
			fieldsOf(schema.get("page")).map((field) => [
				field.name,
				field.type?.name,
			]),
		);
		assert.equal(fieldTypes.title, "localeStringRequired");
		assert.equal(fieldTypes.description, "localeTextRequired");
	});
});

describe("dati aziendali", () => {
	function regexOf(fields: FieldLike[], fieldName: string): RegExp {
		const field = fields.find((f) => f.name === fieldName);
		const regexCall = runValidation(field?.validation).find(
			(call) => call.name === "regex",
		);
		assert.ok(regexCall, `${fieldName}: manca la validazione con regex`);
		return regexCall.args[0] as RegExp;
	}

	const companyFields = fieldsOf(companyInfoType);

	it("la partita IVA ha 11 cifre e la cifra di controllo giusta", () => {
		const field = companyFields.find((f) => f.name === "vatNumber");
		const custom = runValidation(field?.validation).find(
			(call) => call.name === "custom",
		);
		assert.ok(custom, "vatNumber: manca il controllo custom");
		const check = custom.args[0] as (value: unknown) => true | string;
		assert.equal(check("01234567897"), true);
		assert.match(String(check("01234567890")), /non valida/);
		assert.match(String(check("1234567897")), /non valida/);
		assert.match(String(check("IT01234567897")), /non valida/);
	});

	it("il CAP ha 5 cifre", () => {
		const address = companyFields.find((field) => field.name === "address");
		const postalCode = regexOf(address?.fields ?? [], "postalCode");
		assert.ok(postalCode.test("94015"));
		assert.ok(!postalCode.test("9401"));
	});
});

describe("contatti e prenotazioni", () => {
	const urlField = (booking?: "none" | "request" | "external") =>
		fieldsOf(contactsType({ booking }))[0] as FieldLike & { hidden?: boolean };

	it("il link di prenotazione accetta solo https; con request è facoltativo", () => {
		const bookingUrl = urlField("request");
		assert.equal(bookingUrl.name, "bookingUrl");
		const calls = runValidation(bookingUrl.validation);
		assert.equal(
			calls.some((call) => call.name === "required"),
			false,
		);
		const validate = calls.find((call) => call.name === "custom")?.args[0] as
			| ((value?: string) => true | string)
			| undefined;
		assert.ok(validate);
		assert.equal(validate(undefined), true);
		assert.equal(validate("https://thefork.it"), true);
		assert.equal(typeof validate("http://thefork.it"), "string");
		assert.equal(typeof validate("https://127.0.0.1"), "string");
	});

	it("senza la modalità indicata vale request: facoltativo e visibile", () => {
		const field = urlField();
		assert.equal(field.hidden, false);
		assert.equal(
			runValidation(field.validation).some((call) => call.name === "required"),
			false,
		);
	});

	it("external: il link è obbligatorio", () => {
		const calls = runValidation(urlField("external").validation);
		assert.ok(calls.some((call) => call.name === "required"));
		assert.ok(calls.some((call) => call.name === "custom"));
	});

	it("none: il campo si nasconde ma non si toglie", () => {
		const field = urlField("none");
		assert.equal(field.name, "bookingUrl");
		assert.equal(field.hidden, true);
	});

	it("WhatsApp e profili social: facoltativi, con le stesse regole del sito", () => {
		const fields = fieldsOf(contactsType()) as FieldLike[];
		assert.deepEqual(
			fields.map((field) => field.name),
			["bookingUrl", "whatsapp", "instagramUrl", "facebookUrl", "tiktokUrl"],
		);
		for (const name of [
			"whatsapp",
			"instagramUrl",
			"facebookUrl",
			"tiktokUrl",
		]) {
			const field = fields.find((f) => f.name === name);
			const calls = runValidation(field?.validation);
			assert.equal(
				calls.some((call) => call.name === "required"),
				false,
				name,
			);
			assert.ok(
				calls.some((call) => call.name === "custom"),
				name,
			);
		}
		const check = (name: string, value: unknown) => {
			const field = fields.find((f) => f.name === name);
			const custom = runValidation(field?.validation).find(
				(call) => call.name === "custom",
			);
			assert.ok(custom, `${name}: manca la validazione custom`);
			return (custom.args[0] as (v: unknown) => true | string)(value);
		};
		assert.equal(check("whatsapp", "+39 333 123 4567"), true);
		assert.notEqual(check("whatsapp", "333 123 4567"), true);
		assert.equal(check("instagramUrl", "https://www.instagram.com/x"), true);
		assert.notEqual(check("instagramUrl", "https://evil.example/x"), true);
		assert.equal(check("tiktokUrl", undefined), true);
	});

	it("il plugin passa la modalità al documento", () => {
		const types = typesOf({ ...bilingual, booking: "none" });
		const contacts = types.find((type) => type.name === "contacts");
		assert.equal(
			(fieldsOf(contacts) as Array<{ hidden?: boolean }>)[0]?.hidden,
			true,
		);
	});
});
