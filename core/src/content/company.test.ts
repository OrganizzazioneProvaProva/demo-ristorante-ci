import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { companyInfoSchema } from "./company.ts";

const valid = {
	name: "Pizzeria da Mario",
	legalType: "ditta-individuale",
	vatNumber: "01234567897",
	address: {
		street: "Via Roma 1",
		postalCode: "94015",
		city: "Piazza Armerina",
		province: "EN",
	},
};
const ok = (over: object) =>
	companyInfoSchema.safeParse({ ...valid, ...over }).success;

describe("dati aziendali", () => {
	it("accetta una ditta individuale con i dati obbligatori", () => {
		assert.equal(ok({}), true);
		assert.equal(ok({ phone: "0935 000000", email: "info@example.it" }), true);
	});

	it("rifiuta partita IVA, CAP, provincia ed email non validi", () => {
		assert.equal(ok({ vatNumber: "1234567890" }), false);
		assert.equal(ok({ vatNumber: "IT01234567897" }), false);
		assert.equal(ok({ vatNumber: "01234567890" }), false); // cifra di controllo
		assert.equal(
			ok({ address: { ...valid.address, postalCode: "9401" } }),
			false,
		);
		assert.equal(ok({ address: { ...valid.address, province: "en" } }), false);
		assert.equal(ok({ email: "non-una-email" }), false);
	});

	it("rifiuta parametri e separatori URI nell'email aziendale", () => {
		for (const email of ["a@b.it?cc=x", "a@b.it#x", "a@b.it;c@d.it"]) {
			assert.equal(ok({ email }), false, email);
		}
	});

	it("accetta fino a tre indirizzi semplici separati da virgole", () => {
		for (const email of [
			"info@azienda.it",
			"nome.cognome+ordini@azienda.it",
			"a@b.it,c@d.it",
			"a@b.it, c@d.it, e@f.it",
		]) {
			assert.equal(ok({ email }), true, email);
		}
	});

	it("rifiuta indirizzi incompleti, ripetuti, vuoti o fuori limite", () => {
		for (const email of [
			"a b@azienda.it",
			"a@azienda.it\n",
			"a@\tazienda.it",
			"a@@azienda.it",
			"a@azienda",
			"a@b.it,a@B.IT",
			",a@b.it",
			"a@b.it,",
			"a@b.it,,c@d.it",
			"a@b.it,c@d.it,e@f.it,g@h.it",
			`${"a".repeat(250)}@b.it`,
		]) {
			assert.equal(ok({ email }), false, JSON.stringify(email));
		}
	});

	it("rifiuta un tipo di soggetto sconosciuto e dati mancanti", () => {
		assert.equal(ok({ legalType: "associazione" }), false);
		assert.equal(
			companyInfoSchema.safeParse({ ...valid, address: undefined }).success,
			false,
		);
		assert.equal(
			companyInfoSchema.safeParse({ ...valid, name: "  " }).success,
			false,
		);
	});

	it("REA e capitale sociale sono obbligatori per le società di capitali", () => {
		assert.equal(ok({ legalType: "societa-di-capitali" }), false);
		assert.equal(
			ok({ legalType: "societa-di-capitali", reaNumber: "EN-12345" }),
			false,
		);
		assert.equal(
			ok({
				legalType: "societa-di-capitali",
				reaNumber: "EN-12345",
				shareCapital: "10.000 €",
			}),
			true,
		);
		assert.equal(ok({ legalType: "societa-di-persone" }), true);
	});
});
