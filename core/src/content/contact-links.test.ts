import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contactLinks } from "./contact-links.ts";
import { rawContactsSchema } from "./contacts.ts";

describe("contatti sui servizi di terzi", () => {
	it("senza dati non c'è nessun link", () => {
		assert.deepEqual(contactLinks(undefined, "it"), []);
		assert.deepEqual(contactLinks({}, "it"), []);
	});

	it("solo quelli presenti, nell'ordine WhatsApp, Instagram, Facebook, TikTok", () => {
		const contacts = rawContactsSchema.parse({
			tiktokUrl: "https://www.tiktok.com/@locale",
			whatsapp: "+39 333 123 4567",
			instagramUrl: "https://www.instagram.com/locale",
		});
		const links = contactLinks(contacts, "it");
		assert.deepEqual(
			links.map((link) => link.kind),
			["whatsapp", "instagram", "tiktok"],
		);
		assert.equal(links[0]?.href, "https://wa.me/393331234567");
	});

	it("lo schema rifiuta numeri e indirizzi non validi", () => {
		assert.equal(
			rawContactsSchema.safeParse({ whatsapp: "333 123 4567" }).success,
			false,
		);
		assert.equal(
			rawContactsSchema.safeParse({ instagramUrl: "https://evil.example/x" })
				.success,
			false,
		);
		assert.equal(
			rawContactsSchema.safeParse({ facebookUrl: "http://facebook.com/x" })
				.success,
			false,
		);
	});

	it("un valore non valido che arrivasse comunque ferma la build", () => {
		assert.throws(
			() => contactLinks({ whatsapp: "123" }, "it"),
			/WhatsApp non valido/,
		);
		assert.throws(
			() => contactLinks({ tiktokUrl: "https://tiktok.evil.example/" }, "it"),
			/TikTok non valido/,
		);
	});
});
