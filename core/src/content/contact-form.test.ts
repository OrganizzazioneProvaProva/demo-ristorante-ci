import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import {
	BASE_REQUEST_FIELDS,
	contactFormForSite,
	contactFormModel,
	type FormField,
	formSettings,
	HONEYPOT_FIELD,
	isPlaceholderEndpoint,
	PLACEHOLDER_FORM_ENDPOINT,
	requestSchema,
} from "./contact-form.ts";

const valid = {
	name: "Mario Rossi",
	email: "mario@example.com",
	consent: "on",
};

it("compone un modulo del sito con i campi comuni e il link privacy nella lingua", () => {
	const config = parseSiteConfig({
		slug: "prova",
		schemaVersion: 1,
		languages: ["it", "en"],
		modules: { forms: { endpoint: "https://example.com/richiesta" } },
	});
	const model = contactFormForSite(config, "en");
	assert.equal(model.endpoint, "https://example.com/richiesta");
	assert.equal(model.privacyHref, "/en/privacy/");
	assert.deepEqual(
		model.fields.map(({ name }) => name),
		BASE_REQUEST_FIELDS.map(({ name }) => name),
	);
});

describe("schema della richiesta", () => {
	const schema = requestSchema(BASE_REQUEST_FIELDS);

	it("accetta nome, email e consenso", () => {
		assert.ok(schema.safeParse(valid).success);
	});

	it("accetta il solo telefono al posto dell'email", () => {
		const result = schema.safeParse({
			name: "Mario",
			phone: "+39 333 123 4567",
			consent: "on",
		});
		assert.ok(result.success);
	});

	it("tratta i campi vuoti come assenti", () => {
		const result = schema.safeParse({ ...valid, phone: "", message: "" });
		assert.ok(result.success);
	});

	it("accetta 6–15 cifre ASCII, separatori ordinari e spazi esterni", () => {
		for (const phone of ["123456", "+123456789012345", " +12 (34) 56-78.90 "]) {
			const result = schema.parse({ ...valid, email: "", phone });
			assert.equal(result.phone, phone.trim());
		}
		assert.equal(schema.parse({ ...valid, phone: "   " }).phone, undefined);
	});

	it("rifiuta un telefono malformato anche con email valida", () => {
		for (const phone of [
			"()--..",
			"12345",
			"1234567890123456",
			"123\t456",
			"123456\n",
			"123456\u00a0",
			"123+456",
			"１２３４５６",
			"123456 (--------....)",
		]) {
			const result = schema.safeParse({ ...valid, phone });
			assert.ok(
				!result.success &&
					result.error.issues.some((issue) => issue.path[0] === "phone"),
				JSON.stringify(phone),
			);
		}
	});

	it("mantiene nome Unicode e note multilinea, rifiuta controlli nel nome prima del trim", () => {
		const result = schema.parse({
			...valid,
			name: "  Łukasz 李  ",
			message: "Prima riga\nSeconda riga",
		});
		assert.equal(result.name, "Łukasz 李");
		assert.equal(result.message, "Prima riga\nSeconda riga");
		for (const control of [
			"\r",
			"\n",
			"\t",
			"\u0000",
			"\u0085",
			"\u2028",
			"\u2029",
		]) {
			for (const name of [
				`${control}Mario`,
				`Mar${control}io`,
				`Mario${control}`,
			]) {
				assert.equal(
					schema.safeParse({ ...valid, name }).success,
					false,
					JSON.stringify(name),
				);
			}
		}
	});

	it("chiede almeno email o telefono", () => {
		assert.equal(
			schema.safeParse({ name: "Mario", consent: "on" }).success,
			false,
		);
	});

	it("chiede il consenso e il nome", () => {
		assert.equal(
			schema.safeParse({ ...valid, consent: undefined }).success,
			false,
		);
		assert.equal(schema.safeParse({ ...valid, name: "  " }).success, false);
	});

	it("rifiuta email e telefono non validi", () => {
		assert.equal(
			schema.safeParse({ ...valid, email: "non-una-email" }).success,
			false,
		);
		assert.equal(
			schema.safeParse({ name: "M", phone: "abc", consent: "on" }).success,
			false,
		);
	});
});

describe("campi estesi da una nicchia", () => {
	const fields: FormField[] = [
		...BASE_REQUEST_FIELDS,
		{
			name: "date",
			kind: "date",
			required: true,
			label: { it: "Data", en: "Date" },
		},
		{
			name: "people",
			kind: "number",
			required: true,
			min: 1,
			max: 30,
			label: { it: "Persone", en: "People" },
		},
	];
	const schema = requestSchema(fields);

	it("convalida data reale e numero di persone", () => {
		assert.ok(
			schema.safeParse({ ...valid, date: "2026-12-24", people: "4" }).success,
		);
		assert.equal(
			schema.safeParse({ ...valid, date: "2026-02-30", people: "4" }).success,
			false,
		);
		assert.equal(
			schema.safeParse({ ...valid, date: "2026-12-24", people: "0" }).success,
			false,
		);
		assert.equal(
			schema.safeParse({ ...valid, date: "2026-12-24", people: "31" }).success,
			false,
		);
	});

	it("il campo trappola è vuoto per le persone: pieno vuol dire bot", () => {
		const schema = requestSchema(BASE_REQUEST_FIELDS);
		const valid = { name: "Anna", email: "a@b.it", consent: "on" };
		assert.equal(schema.safeParse(valid).success, true);
		assert.equal(schema.safeParse({ ...valid, website: "" }).success, true);
		assert.equal(
			schema.safeParse({ ...valid, website: "http://spam" }).success,
			false,
		);
	});

	it("rifiuta nomi di campo ripetuti o riservati", () => {
		assert.throws(() =>
			requestSchema([...BASE_REQUEST_FIELDS, BASE_REQUEST_FIELDS[0]]),
		);
		assert.throws(() =>
			requestSchema([
				{
					name: "website",
					kind: "text",
					required: false,
					label: { it: "x", en: "x" },
				},
			]),
		);
		assert.throws(() =>
			requestSchema([
				{
					name: "consent",
					kind: "text",
					required: false,
					label: { it: "x", en: "x" },
				},
			]),
		);
	});
});

describe("modello del form", () => {
	const base = {
		fields: BASE_REQUEST_FIELDS,
		endpoint: PLACEHOLDER_FORM_ENDPOINT,
		privacyHref: "/privacy/",
	};

	it("risolve etichette e testi nella lingua", () => {
		const it = contactFormModel({ ...base, language: "it" });
		const en = contactFormModel({ ...base, language: "en" });
		assert.equal(it.labels.submit, "Invia la richiesta");
		assert.equal(en.labels.submit, "Send the request");
		assert.equal(it.fields[0].label, "Nome e cognome");
		assert.equal(en.fields[0].label, "Full name");
	});

	it("si ferma senza https o senza un link all'informativa valido", () => {
		assert.throws(
			() =>
				contactFormModel({
					...base,
					language: "it",
					endpoint: "http://x.it/f",
				}),
			/https/,
		);
		assert.throws(
			() => contactFormModel({ ...base, language: "it", privacyHref: "" }),
			/informativa/,
		);
		assert.throws(
			() =>
				contactFormModel({
					...base,
					language: "it",
					privacyHref: "//evil.com",
				}),
			/informativa/,
		);
	});

	it("accetta un percorso del sito come destinazione, non un indirizzo `//host`", () => {
		const model = contactFormModel({
			...base,
			language: "it",
			endpoint: "/api/richiesta",
		});
		assert.equal(model.endpoint, "/api/richiesta");
		assert.throws(
			() =>
				contactFormModel({ ...base, language: "it", endpoint: "//evil.com/f" }),
			/Indirizzo di invio/,
		);
	});

	it("il campo trappola c'è sempre; la chiave Turnstile solo se passata", () => {
		const plain = contactFormModel({ ...base, language: "it" });
		assert.equal(plain.honeypotName, HONEYPOT_FIELD);
		assert.equal(plain.turnstileSiteKey, undefined);
		const withKey = contactFormModel({
			...base,
			language: "it",
			turnstileSiteKey: "SyntheticPublicSiteKey123",
		});
		assert.equal(withKey.turnstileSiteKey, "SyntheticPublicSiteKey123");
	});

	it("formSettings: segnaposto senza endpoint, chiave solo con antispam turnstile", () => {
		const none = parseSiteConfig({ slug: "t", schemaVersion: 1 });
		assert.deepEqual(formSettings(none), {
			endpoint: PLACEHOLDER_FORM_ENDPOINT,
			turnstileSiteKey: undefined,
		});
		const on = parseSiteConfig({
			slug: "t",
			schemaVersion: 1,
			modules: {
				antispam: "turnstile",
				forms: {
					endpoint: "/api/r",
					turnstileSiteKey: "SyntheticPublicSiteKey123",
				},
			},
		});
		assert.deepEqual(formSettings(on), {
			endpoint: "/api/r",
			turnstileSiteKey: "SyntheticPublicSiteKey123",
		});
	});

	it("riconosce l'indirizzo segnaposto", () => {
		assert.ok(isPlaceholderEndpoint(PLACEHOLDER_FORM_ENDPOINT));
		assert.equal(
			isPlaceholderEndpoint("https://forms.example.it/richiesta"),
			false,
		);
	});

	it("canonicalizza anche nel modello e non riporta l'endpoint invalido", () => {
		const endpoint = "https://FORM.EXAMPLE.IT:8443/a/../submit?tag=ok";
		assert.equal(
			contactFormModel({ ...base, language: "it", endpoint }).endpoint,
			"https://form.example.it:8443/submit?tag=ok",
		);
		assert.equal(
			formSettings({ modules: { forms: { endpoint } } }).endpoint,
			"https://form.example.it:8443/submit?tag=ok",
		);
		for (const invalid of [
			"/\\external.example/r",
			"https://utente@external.example/",
		]) {
			assert.throws(
				() => contactFormModel({ ...base, language: "it", endpoint: invalid }),
				(error: Error) =>
					/Indirizzo di invio del modulo non valido/.test(error.message) &&
					!error.message.includes(invalid),
			);
		}
	});
});
