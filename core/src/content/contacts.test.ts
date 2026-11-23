import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	rawContactsSchema,
	resolveBooking,
	resolveSiteBooking,
} from "./contacts.ts";
import { contactActions } from "./shell.ts";

describe("contatti", () => {
	it("accetta un documento vuoto o con un link https", () => {
		assert.ok(rawContactsSchema.safeParse({}).success);
		assert.ok(rawContactsSchema.safeParse({ bookingUrl: null }).success);
		assert.ok(
			rawContactsSchema.safeParse({ bookingUrl: "https://prenota.example/x" })
				.success,
		);
	});

	it("rifiuta i link che non sono https", () => {
		for (const bad of ["http://x.example", "javascript:alert(1)", "prenota"]) {
			assert.equal(
				rawContactsSchema.safeParse({ bookingUrl: bad }).success,
				false,
				bad,
			);
		}
	});
});

describe("prenotazioni: modalità del sito", () => {
	const form = "/contatti/#prenota";
	const external = { bookingUrl: "https://prenota.example/x" };

	it("legge la modalità del sito e usa il percorso fornito per la richiesta", () => {
		const href = "/en/contatti/#richiesta";
		assert.deepEqual(
			resolveSiteBooking({ modules: { booking: "request" } }, {}, href),
			{
				mode: "request",
				href,
				form: "booking",
			},
		);
		assert.deepEqual(
			resolveSiteBooking({ modules: { booking: "none" } }, {}, href),
			{
				mode: "none",
				form: "contact",
			},
		);
	});

	it("request: il link esterno ha la precedenza, altrimenti il modulo del sito", () => {
		assert.deepEqual(resolveBooking("request", external, form), {
			mode: "request",
			href: "https://prenota.example/x",
			form: "booking",
		});
		assert.equal(resolveBooking("request", {}, form).href, form);
		assert.equal(resolveBooking("request", null, form).href, form);
		assert.equal(resolveBooking("request", {}, form).form, "booking");
	});

	it("external: serve il link, senza la build si ferma", () => {
		assert.deepEqual(resolveBooking("external", external, form), {
			mode: "external",
			href: "https://prenota.example/x",
			form: "contact",
		});
		assert.throws(() => resolveBooking("external", {}, form), /serve il link/);
		assert.throws(
			() => resolveBooking("external", null, form),
			/build si ferma/,
		);
	});

	it("none: nessun pulsante, form di contatto; un link rimasto nello Studio si ignora con un avviso", (t) => {
		const warn = t.mock.method(console, "warn", () => {});
		assert.deepEqual(resolveBooking("none", {}, form), {
			mode: "none",
			form: "contact",
		});
		assert.equal(warn.mock.callCount(), 0);
		const result = resolveBooking("none", external, form);
		assert.equal(result.href, undefined);
		assert.equal(warn.mock.callCount(), 1);
	});

	it("senza prenotazioni la prima azione della barra è Chiama, senza Prenota", () => {
		const company = {
			phone: "+39 0935 000000",
			address: {
				street: "Via Esempio 1",
				postalCode: "94015",
				city: "Piazza Armerina",
				province: "EN",
			},
		};
		const none = resolveBooking("none", {}, form);
		const actions = contactActions(company, "it", { bookingUrl: none.href });
		assert.deepEqual(
			actions.map((a) => a.label),
			["Chiama", "Mappa"],
		);
		const request = resolveBooking("request", {}, form);
		assert.equal(
			contactActions(company, "it", { bookingUrl: request.href })[0]?.label,
			"Prenota",
		);
	});
});
