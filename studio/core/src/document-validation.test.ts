// Prove con il VALIDATORE VERO di Sanity (`@sanity/validation`, lo stesso dello Studio) su
// documenti di esempio, senza progetto né login. Verificano il comportamento che i test
// sulle singole regole non possono dimostrare: per esempio, cosa succede a un campo per
// lingua facoltativo che non è stato compilato.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateDocument } from "@sanity/validation";
import { createSchema, type SchemaTypeDefinition } from "sanity";
import { sitiStudioCore } from "./index.ts";

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

function schemaFor(languages: readonly ("it" | "en")[]) {
	const plugin = sitiStudioCore({ languages, defaultLanguage: "it" });
	return createSchema({
		name: "default",
		types: plugin.schema?.types as SchemaTypeDefinition[],
	});
}

type Marker = { level: string; message: string; path: unknown[] };

async function validate(
	document: Record<string, unknown>,
	languages: readonly ("it" | "en")[] = ["it", "en"],
) {
	const result = await validateDocument({
		document: {
			_createdAt: "2026-11-18T10:00:00Z",
			_updatedAt: "2026-11-18T10:00:00Z",
			_rev: "rev1",
			...document,
		} as never,
		schema: schemaFor(languages),
		client: client as never,
		getDocumentExists: async () => true,
		validateReferenceTypes: false,
	});
	assert.equal(result.complete, true, "la validazione deve essere completa");
	return result.markers as Marker[];
}

const pathOf = (marker: Marker) =>
	marker.path
		.map((segment) =>
			typeof segment === "object" && segment !== null && "_key" in segment
				? `[${(segment as { _key: string })._key}]`
				: String(segment),
		)
		.join(".");

const errors = (markers: Marker[]) =>
	markers.filter((m) => m.level === "error").map(pathOf);
const warnings = (markers: Marker[]) =>
	markers.filter((m) => m.level === "warning").map(pathOf);

it("lo Studio rifiuta credenziali, IP e parametri mailto nei link CMS", async () => {
	const contacts = { _id: "contacts", _type: "contacts" };
	assert.deepEqual(
		[
			...new Set(
				errors(
					await validate({
						...contacts,
						bookingUrl: "https://google.com@evil.example/",
					}),
				),
			),
		],
		["bookingUrl"],
	);
	assert.deepEqual(
		errors(await validate({ ...contacts, bookingUrl: "https://127.0.0.1/" })),
		["bookingUrl"],
	);
	const home = {
		_id: "home",
		_type: "home",
		title: { it: "Titolo" },
		description: { it: "Descrizione" },
		heroTitle: { it: "Titolo" },
		socialProof: {
			rating: 5,
			sourceName: "Fonte",
			sourceUrl: "https://127.0.0.1/",
		},
	};
	assert.deepEqual(errors(await validate(home, ["it"])), [
		"socialProof.sourceUrl",
	]);
	const promotion = {
		_id: "promo-link",
		_type: "promotion",
		title: { it: "Titolo" },
	};
	assert.deepEqual(
		errors(
			await validate({ ...promotion, link: "mailto:a@b.it?cc=c@d.it" }, ["it"]),
		),
		["link"],
	);
	assert.deepEqual(
		errors(
			await validate({ ...promotion, link: "mailto:a@b.it, c+d@e.it" }, ["it"]),
		),
		[],
	);
});

it("lo Studio rifiuta parametri mailto e accetta più indirizzi aziendali", async () => {
	const company = {
		_id: "companyInfo",
		_type: "companyInfo",
		name: "Attività di prova",
		legalType: "ditta-individuale",
		vatNumber: "01234567897",
		address: {
			street: "Via Roma 1",
			postalCode: "94015",
			city: "Piazza Armerina",
			province: "EN",
		},
	};
	assert.deepEqual(
		errors(await validate({ ...company, email: "a@b.it?cc=x&body=y" })),
		["email"],
	);
	assert.deepEqual(
		errors(await validate({ ...company, email: "a@b.it, c+d@e.it" })),
		[],
	);
});

const image = (extra: Record<string, unknown> = {}) => ({
	_type: "siteImage",
	asset: { _type: "reference", _ref: "image-abc123-800x600-jpg" },
	...extra,
});

describe("campi per lingua facoltativi (validatore vero di Sanity)", () => {
	it("una promozione con il titolo in tutte le lingue è valida: descrizione e immagine assenti non bloccano", async () => {
		const markers = await validate({
			_id: "promo1",
			_type: "promotion",
			title: { it: "Sconto del 10%", en: "10% off" },
		});
		assert.deepEqual(errors(markers), []);
	});

	it("se si compila solo l'inglese di un campo facoltativo, l'italiano diventa obbligatorio", async () => {
		const markers = await validate({
			_id: "promo2",
			_type: "promotion",
			title: { it: "Sconto", en: "Discount" },
			description: { en: "Ten percent off" },
		});
		assert.deepEqual(errors(markers), ["description.it"]);
	});

	it("la lingua mancante in un campo facoltativo (la descrizione) è solo un avviso, non un errore", async () => {
		const markers = await validate({
			_id: "promo3",
			_type: "promotion",
			title: { it: "Sconto", en: "Discount" },
			description: { it: "Dieci per cento" },
		});
		assert.deepEqual(errors(markers), []);
		assert.ok(
			warnings(markers).includes("description.en"),
			`avviso atteso su description.en, trovati: ${warnings(markers)}`,
		);
	});

	it("un titolo assente è un errore", async () => {
		const markers = await validate({ _id: "promo4", _type: "promotion" });
		assert.ok(errors(markers).includes("title.it"), errors(markers).join());
	});

	it("la chiusura straordinaria: il motivo è facoltativo", async () => {
		const day = { _type: "openingDay", closed: true };
		const hours = {
			_id: "openingHours",
			_type: "openingHours",
			monday: day,
			tuesday: day,
			wednesday: day,
			thursday: day,
			friday: day,
			saturday: day,
			sunday: day,
		};
		const without = await validate({
			...hours,
			closures: [
				{
					_type: "closurePeriod",
					_key: "c1",
					from: "2026-08-10",
					to: "2026-08-20",
				},
			],
		});
		assert.deepEqual(errors(without), []);

		const onlyEnglish = await validate({
			...hours,
			closures: [
				{
					_type: "closurePeriod",
					_key: "c1",
					from: "2026-08-10",
					to: "2026-08-20",
					reason: { en: "Holiday" },
				},
			],
		});
		assert.deepEqual(errors(onlyEnglish), ["closures.[c1].reason.it"]);
	});
});

describe("testo alternativo delle immagini", () => {
	const promo = (img: unknown) => ({
		_id: "promo-img",
		_type: "promotion",
		title: { it: "Sconto", en: "Discount" },
		image: img,
	});

	it("un'immagine non decorativa senza testo alternativo è un errore", async () => {
		const markers = await validate(promo(image({ decorative: false })));
		assert.ok(errors(markers).includes("image.alt.it"), errors(markers).join());
	});

	it("un'immagine decorativa non richiede il testo alternativo", async () => {
		const markers = await validate(promo(image({ decorative: true })));
		assert.deepEqual(errors(markers), []);
	});

	it("con il testo alternativo italiano è valida", async () => {
		const markers = await validate(
			promo(image({ decorative: false, alt: { it: "Una pizza margherita" } })),
		);
		assert.deepEqual(errors(markers), []);
	});

	const altMessages = (markers: Marker[]) =>
		markers
			.filter((m) => m.level === "warning" && pathOf(m) === "image.alt.en")
			.map((m) => m.message);

	it("alt inglese mancante: avviso (non errore) che dice cosa succede alla foto", async () => {
		const markers = await validate(
			promo(image({ decorative: false, alt: { it: "Una pizza" } })),
		);
		assert.deepEqual(errors(markers), []);
		const [message] = altMessages(markers);
		assert.match(String(message), /testo italiano/);
	});

	it("alt inglese mancante su immagine informativa: l'avviso dice che non comparirà", async () => {
		const markers = await validate(
			promo(
				image({
					decorative: false,
					informative: true,
					alt: { it: "Il menu" },
				}),
			),
		);
		assert.match(String(altMessages(markers)[0]), /non comparirà/);
	});

	it("immagine decorativa: nessun avviso sull'alt inglese", async () => {
		const markers = await validate(promo(image({ decorative: true })));
		assert.deepEqual(altMessages(markers), []);
	});
});

describe("galleria", () => {
	it("nella galleria il testo alternativo si valuta immagine per immagine (percorso con _key)", async () => {
		const asset = { _type: "reference", _ref: "image-abc123-800x600-jpg" };
		const markers = await validate({
			_id: "gallery",
			_type: "gallery",
			images: [
				{ _type: "siteImage", _key: "a", asset, decorative: true },
				{ _type: "siteImage", _key: "b", asset, decorative: false },
				{
					_type: "siteImage",
					_key: "c",
					asset,
					decorative: false,
					alt: { it: "Il forno a legna" },
				},
			],
		});
		assert.deepEqual(errors(markers), ["images.[b].alt.it"]);
	});
});

describe("orari di apertura", () => {
	const closed = { _type: "openingDay", closed: true };
	const week = (override: Record<string, unknown> = {}) => ({
		_id: "openingHours",
		_type: "openingHours",
		monday: closed,
		tuesday: {
			_type: "openingDay",
			closed: false,
			intervals: [
				{ _type: "timeInterval", _key: "a", opens: "12:00", closes: "15:00" },
				{ _type: "timeInterval", _key: "b", opens: "19:00", closes: "23:30" },
			],
		},
		wednesday: closed,
		thursday: closed,
		friday: closed,
		saturday: closed,
		sunday: closed,
		...override,
	});

	it("pranzo e cena nello stesso giorno sono validi", async () => {
		assert.deepEqual(errors(await validate(week())), []);
	});

	it("un giorno senza fasce e non chiuso è un errore", async () => {
		const markers = await validate(
			week({ monday: { _type: "openingDay", closed: false } }),
		);
		assert.ok(
			errors(markers).includes("monday.intervals"),
			errors(markers).join(),
		);
	});

	it("fasce sovrapposte sono un errore", async () => {
		const markers = await validate(
			week({
				tuesday: {
					_type: "openingDay",
					closed: false,
					intervals: [
						{
							_type: "timeInterval",
							_key: "a",
							opens: "12:00",
							closes: "15:00",
						},
						{
							_type: "timeInterval",
							_key: "b",
							opens: "14:00",
							closes: "16:00",
						},
					],
				},
			}),
		);
		assert.ok(
			errors(markers).includes("tuesday.intervals"),
			errors(markers).join(),
		);
	});

	it("un orario scritto male è un errore", async () => {
		const markers = await validate(
			week({
				tuesday: {
					_type: "openingDay",
					closed: false,
					intervals: [
						{
							_type: "timeInterval",
							_key: "a",
							opens: "25:00",
							closes: "15:00",
						},
					],
				},
			}),
		);
		assert.ok(
			errors(markers).some((p) => p.startsWith("tuesday.intervals")),
			errors(markers).join(),
		);
	});
});

describe("festa del patrono", () => {
	it("la festa del patrono con una data inesistente è un errore (non un avviso)", async () => {
		const closed = { _type: "openingDay", closed: true };
		const markers = await validate({
			_id: "openingHours",
			_type: "openingHours",
			monday: closed,
			tuesday: closed,
			wednesday: closed,
			thursday: closed,
			friday: closed,
			saturday: closed,
			sunday: closed,
			patronSaintDay: { day: 31, month: 4 },
		});
		assert.deepEqual(errors(markers), ["patronSaintDay.day"]);
	});
});

describe("pagina", () => {
	it("senza descrizione italiana non è valida", async () => {
		const markers = await validate({
			_id: "page1",
			_type: "page",
			title: { it: "Chi siamo" },
			slug: { _type: "slug", current: "chi-siamo" },
		});
		assert.ok(
			errors(markers).includes("description.it"),
			errors(markers).join(),
		);
	});

	it("con titolo, descrizione e slug è valida", async () => {
		const markers = await validate({
			_id: "page2",
			_type: "page",
			title: { it: "Chi siamo", en: "About us" },
			description: { it: "La nostra storia", en: "Our story" },
			slug: { _type: "slug", current: "chi-siamo" },
		});
		assert.deepEqual(errors(markers), []);
	});
});

describe("traduzioni obbligatorie in un sito bilingue (home e pagina)", () => {
	const homeIt = {
		_id: "home",
		_type: "home",
		title: { it: "Pizzeria da Mario" },
		description: { it: "Pizza a Piazza Armerina" },
		heroTitle: { it: "Pizza al forno a legna" },
	};
	const pageIt = {
		_id: "p1",
		_type: "page",
		title: { it: "Chi siamo" },
		description: { it: "La nostra storia" },
		slug: { _type: "slug", current: "chi-siamo" },
	};

	it("home con i soli testi italiani: tre ERRORI (non avvisi) sui campi inglesi, che bloccano la pubblicazione", async () => {
		const markers = await validate(homeIt);
		assert.deepEqual(errors(markers).sort(), [
			"description.en",
			"heroTitle.en",
			"title.en",
		]);
		const message = markers.find((m) => m.level === "error")?.message ?? "";
		assert.match(message, /Manca la traduzione in English/);
		assert.match(message, /Pubblica solo in Italiano/);
	});

	it("con «Pubblica solo in Italiano» acceso la home è valida e non ci sono nemmeno avvisi", async () => {
		const markers = await validate({ ...homeIt, onlyDefaultLanguage: true });
		assert.deepEqual(errors(markers), []);
		assert.deepEqual(warnings(markers), []);
	});

	it("con il flag acceso l'italiano resta obbligatorio", async () => {
		const markers = await validate({
			...homeIt,
			heroTitle: {},
			onlyDefaultLanguage: true,
		});
		assert.ok(errors(markers).includes("heroTitle.it"), errors(markers).join());
	});

	it("home tradotta per intero: nessun errore", async () => {
		const markers = await validate({
			...homeIt,
			title: { it: "Pizzeria da Mario", en: "Mario's Pizzeria" },
			description: {
				it: "Pizza a Piazza Armerina",
				en: "Pizza in Piazza Armerina",
			},
			heroTitle: { it: "Pizza al forno a legna", en: "Wood-fired pizza" },
		});
		assert.deepEqual(errors(markers), []);
	});

	it("manca solo il titolo principale in inglese: l'errore è solo su quello", async () => {
		const markers = await validate({
			...homeIt,
			title: { it: "Pizzeria da Mario", en: "Mario's Pizzeria" },
			description: {
				it: "Pizza a Piazza Armerina",
				en: "Pizza in Piazza Armerina",
			},
		});
		assert.deepEqual(errors(markers), ["heroTitle.en"]);
	});

	it("la pagina con i soli testi italiani ha errori sui campi inglesi, con il flag è valida", async () => {
		assert.deepEqual(errors(await validate(pageIt)).sort(), [
			"description.en",
			"title.en",
		]);
		assert.deepEqual(
			errors(await validate({ ...pageIt, onlyDefaultLanguage: true })),
			[],
		);
	});

	it("un sito solo italiano non richiede nessuna lingua in più", async () => {
		assert.deepEqual(errors(await validate(pageIt, ["it"])), []);
	});

	it("l'avviso urgente: solo in italiano è un errore, con «Pubblica solo in Italiano» è valido (il caso «chiuso oggi»)", async () => {
		const notice = {
			_id: "notice1",
			_type: "notice",
			message: { it: "Oggi siamo chiusi" },
		};
		assert.deepEqual(errors(await validate(notice)), ["message.en"]);
		const urgent = await validate({ ...notice, onlyDefaultLanguage: true });
		assert.deepEqual(errors(urgent), []);
		assert.deepEqual(warnings(urgent), []);
	});

	it("la promozione solo in italiano è un errore, con il flag è valida; il titolo italiano resta obbligatorio", async () => {
		const promo = {
			_id: "promo1",
			_type: "promotion",
			title: { it: "Menu del giorno" },
		};
		assert.deepEqual(errors(await validate(promo)), ["title.en"]);
		assert.deepEqual(
			errors(await validate({ ...promo, onlyDefaultLanguage: true })),
			[],
		);
		const noItalian = await validate({
			...promo,
			title: {},
			onlyDefaultLanguage: true,
		});
		assert.ok(errors(noItalian).includes("title.it"), errors(noItalian).join());
	});

	it("in un sito solo italiano promozioni e avvisi non chiedono nessuna traduzione", async () => {
		const markers = await validate(
			{ _id: "notice1", _type: "notice", message: { it: "Oggi chiusi" } },
			["it"],
		);
		assert.deepEqual(errors(markers), []);
	});

	it("lo slug «home» è riservato nella pagina (nello Studio è un avviso: il validatore declassa i controlli sugli oggetti; la build lo rifiuta)", async () => {
		const markers = await validate({
			...pageIt,
			title: { it: "Home", en: "Home" },
			description: { it: "x", en: "x" },
			slug: { _type: "slug", current: "home" },
		});
		assert.ok(
			warnings(markers).some((path) => path.startsWith("slug")),
			warnings(markers).join(),
		);
	});
});

describe("slug delle pagine legali", () => {
	const pageIt = { _id: "p2", _type: "page" };
	it("gli slug delle pagine legali sono riservati nella pagina (avviso nello Studio; la build usa la pagina legale)", async () => {
		for (const current of [
			"privacy",
			"cookie",
			"note-legali",
			"accessibilita",
		]) {
			const markers = await validate({
				...pageIt,
				title: { it: "Mia pagina", en: "My page" },
				description: { it: "x", en: "x" },
				slug: { _type: "slug", current },
			});
			assert.ok(
				warnings(markers).some((path) => path.startsWith("slug")),
				`${current}: ${warnings(markers).join()}`,
			);
		}
	});

	it("uno slug normale non dà avvisi sullo slug", async () => {
		const markers = await validate({
			...pageIt,
			title: { it: "Chi siamo", en: "About" },
			description: { it: "x", en: "x" },
			slug: { _type: "slug", current: "chi-siamo" },
		});
		assert.equal(
			warnings(markers).some((path) => path.startsWith("slug")),
			false,
		);
	});
});

describe("home e valutazione online", () => {
	const home = (extra: Record<string, unknown> = {}) => ({
		_id: "home",
		_type: "home",
		title: { it: "Pizzeria da Mario", en: "Mario's Pizzeria" },
		description: {
			it: "Pizza a Piazza Armerina",
			en: "Pizza in Piazza Armerina",
		},
		heroTitle: { it: "Pizza al forno a legna", en: "Wood-fired pizza" },
		...extra,
	});

	it("un sito solo italiano con i soli testi italiani è valido", async () => {
		const markers = await validate(
			{
				_id: "home",
				_type: "home",
				title: { it: "Pizzeria da Mario" },
				description: { it: "Pizza a Piazza Armerina" },
				heroTitle: { it: "Ciao" },
			},
			["it"],
		);
		assert.deepEqual(errors(markers), []);
	});

	it("senza alcun titolo (campo assente) è comunque un errore su heroTitle.it", async () => {
		const markers = await validate({ _id: "home", _type: "home" });
		assert.ok(errors(markers).includes("heroTitle.it"), errors(markers).join());
	});

	it("senza titolo italiano è un errore", async () => {
		const markers = await validate(home({ heroTitle: { en: "Hi" } }));
		assert.ok(errors(markers).includes("heroTitle.it"), errors(markers).join());
	});

	it("la valutazione richiede fonte e link https, e un voto da 1 a 5", async () => {
		const ok = await validate(
			home({
				socialProof: {
					rating: 4.7,
					sourceName: "Google",
					sourceUrl: "https://example.com/r",
				},
			}),
		);
		assert.deepEqual(errors(ok), []);
		const bad = await validate(
			home({
				socialProof: {
					rating: 7,
					sourceName: "Google",
					sourceUrl: "http://example.com/r",
				},
			}),
		);
		assert.deepEqual(errors(bad).sort(), [
			"socialProof.rating",
			"socialProof.sourceUrl",
		]);
	});
});
