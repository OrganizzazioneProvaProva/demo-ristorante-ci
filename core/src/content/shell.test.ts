import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompanyInfo } from "./company.ts";
import {
	contactActions,
	mapHref,
	resolveSiteShell,
	SHELL_LABELS,
	socialProofText,
	telHref,
} from "./shell.ts";

const address = {
	street: "Via Esempio 12",
	postalCode: "94015",
	city: "Piazza Armerina",
	province: "EN",
};

describe("resolveSiteShell", () => {
	const company: CompanyInfo = {
		name: "Azienda X",
		legalType: "ditta-individuale",
		vatNumber: "01234567897",
		address,
	};
	const navigation = [
		{ slug: "home", label: { it: "Home", en: "Home" } },
		{ slug: "servizi", label: { it: "Servizi", en: "Services" } },
	];

	it("mantiene ordine, lingua e pagina corrente, con Chiama pieno nella barra", () => {
		const shell = resolveSiteShell({
			config: { defaultLanguage: "it" },
			language: "en",
			currentSlug: "servizi",
			navigation,
			company: { ...company, phone: "+39 000 000000" },
			contacts: { instagramUrl: "https://www.instagram.com/" },
		});
		assert.equal(shell.homeHref, "/en/");
		assert.deepEqual(shell.nav, [
			{ href: "/en/", label: "Home", current: false },
			{ href: "/en/servizi/", label: "Services", current: true },
		]);
		assert.deepEqual(
			shell.heroActions.map(({ label }) => label),
			["Call", "Map"],
		);
		assert.deepEqual(shell.actions, [
			{ label: "Map", href: mapHref(company) },
			{ label: "Call", href: "tel:+39000000000", primary: true },
		]);
		assert.equal(shell.legalLinks[0]?.href, "/en/privacy/");
		assert.equal(shell.contactLinks[0]?.kind, "instagram");
	});

	it("senza telefono usa soltanto la mappa e nessuna voce corrente per una pagina fuori navigazione", () => {
		const shell = resolveSiteShell({
			config: { defaultLanguage: "it" },
			language: "it",
			currentSlug: "privacy",
			navigation,
			company,
		});
		assert.deepEqual(shell.actions, [
			{ label: "Mappa", href: mapHref(company) },
		]);
		assert.deepEqual(shell.heroActions, shell.actions);
		assert.ok(shell.nav.every(({ current }) => !current));
	});
});

describe("telHref", () => {
	it("toglie spazi, punti, trattini e parentesi e tiene il + iniziale", () => {
		assert.equal(telHref("+39 0935 000000"), "tel:+390935000000");
		assert.equal(telHref("0935-000.000"), "tel:0935000000");
		assert.equal(telHref("(0935) 000 000"), "tel:0935000000");
	});

	it("rifiuta numeri non plausibili: lettere, schemi diversi, troppo corti o troppo lunghi", () => {
		for (const phone of [
			"chiama noi",
			"javascript:alert(1)",
			"12345",
			"1234567890123456",
			"+39+0935000000",
			"",
		]) {
			assert.equal(telHref(phone), undefined, phone);
		}
	});
});

describe("mapHref", () => {
	it("con coordinate usa il punto preciso, con la virgola codificata (%2C)", () => {
		assert.equal(
			mapHref({ address }, "37.3856, 14.3708"),
			"https://www.google.com/maps/search/?api=1&query=37.3856%2C14.3708",
		);
	});

	it("senza coordinate cerca l'indirizzo, codificato", () => {
		const href = mapHref({ address });
		assert.match(
			href,
			/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/,
		);
		assert.ok(
			href.includes(
				encodeURIComponent("Via Esempio 12, 94015 Piazza Armerina EN"),
			),
		);
	});

	it("una query che non è lat,lng ferma la build", () => {
		for (const bad of ["Piazza Armerina", "37.38", "37.38;14.37", "<script>"]) {
			assert.throws(
				() => mapHref({ address }, bad),
				/mapQuery non valida/,
				bad,
			);
		}
	});
});

describe("contactActions", () => {
	it("con telefono: Chiama per prima, poi Mappa", () => {
		const actions = contactActions({ phone: "+39 0935 000000", address }, "it");
		assert.deepEqual(
			actions.map((action) => action.label),
			["Chiama", "Mappa"],
		);
		assert.equal(actions[0]?.href, "tel:+390935000000");
	});

	it("senza telefono o con un telefono non valido: solo Mappa", () => {
		assert.deepEqual(
			contactActions({ address }, "it").map((a) => a.label),
			["Mappa"],
		);
		assert.deepEqual(
			contactActions({ phone: "non so", address }, "it").map((a) => a.label),
			["Mappa"],
		);
	});

	it("le etichette seguono la lingua", () => {
		const actions = contactActions({ phone: "+390935000000", address }, "en");
		assert.deepEqual(
			actions.map((action) => action.label),
			["Call", "Map"],
		);
	});
});

describe("contactActions con prenotazione", () => {
	const base = { phone: "+39 0935 000000", address };

	it("con un modulo di prenotazione, Prenota è la prima azione (il pulsante pieno)", () => {
		const actions = contactActions(base, "it", {
			bookingUrl: "https://prenota.example/ristorante-x",
		});
		assert.deepEqual(
			actions.map((action) => action.label),
			["Prenota", "Chiama", "Mappa"],
		);
		assert.equal(actions[0]?.href, "https://prenota.example/ristorante-x");
	});

	it("un bookingUrl può essere un percorso del sito (il modulo interno)", () => {
		const actions = contactActions(base, "it", {
			bookingUrl: "/contatti/#prenota",
		});
		assert.equal(actions[0]?.label, "Prenota");
		assert.equal(actions[0]?.href, "/contatti/#prenota");
	});

	it("un bookingUrl che non è https né un percorso del sito ferma la build", () => {
		for (const bad of [
			"http://x.example",
			"javascript:alert(1)",
			"//evil.example",
			"prenota",
			"",
		]) {
			assert.throws(
				() => contactActions(base, "it", { bookingUrl: bad }),
				/bookingUrl non valido/,
				bad,
			);
		}
	});

	it("senza prenotazione Chiama resta la prima", () => {
		assert.equal(contactActions(base, "en")[0]?.label, "Call");
	});
});

describe("socialProofText", () => {
	it("scrive voto con la virgola in italiano e il punto in inglese, con il numero di recensioni", () => {
		const proof = { rating: 4.7, reviewCount: 1200, sourceName: "Google" };
		assert.equal(
			socialProofText(proof, "it").summary,
			"4,7 su Google · 1200 recensioni",
		);
		assert.equal(
			socialProofText(proof, "en").summary,
			"4.7 on Google · 1,200 reviews",
		);
	});

	it("una sola recensione è al singolare; senza numero non compare", () => {
		assert.equal(
			socialProofText({ rating: 5, reviewCount: 1, sourceName: "Google" }, "it")
				.summary,
			"5,0 su Google · 1 recensione",
		);
		assert.equal(
			socialProofText({ rating: 4.5, sourceName: "Google" }, "en").summary,
			"4.5 on Google",
		);
	});
});

describe("SHELL_LABELS", () => {
	it("ogni lingua ha tutte le voci, non vuote e senza ripiego sull'italiano", () => {
		const collect = (value: unknown): string[] =>
			typeof value === "string"
				? [value]
				: Object.values(value as object).flatMap(collect);
		for (const [language, labels] of Object.entries(SHELL_LABELS)) {
			const strings = collect(labels);
			assert.equal(strings.length, collect(SHELL_LABELS.it).length, language);
			assert.ok(strings.length >= 17, language);
			assert.ok(
				strings.every((text) => text.trim().length > 0),
				language,
			);
		}
		assert.notEqual(SHELL_LABELS.en.call, SHELL_LABELS.it.call);
		assert.notEqual(SHELL_LABELS.en.navigation, SHELL_LABELS.it.navigation);
	});
});
