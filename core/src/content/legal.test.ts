import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import { DECLARED_STORAGE } from "../checks/storage-rules.ts";
import { companyInfoSchema } from "./company.ts";
import {
	isLegalSlug,
	LEGAL_LABELS,
	LEGAL_SLUGS,
	legalLinks,
	withLegalPages,
} from "./legal.ts";
import {
	LEGAL_MODEL_REVIEWED,
	LEGAL_MODEL_VERSION,
	type LegalBlock,
	type LegalFeatures,
	type LegalSection,
	legalDraft,
	legalSections,
	resolveLegalFeatures,
} from "./legal-text.ts";
import { formatDay } from "./section-labels.ts";

const config = parseSiteConfig({
	slug: "t",
	schemaVersion: 1,
	languages: ["it", "en"],
});
const base = {
	name: "Ristorante X",
	legalType: "societa-di-capitali" as const,
	vatNumber: "01234567897",
	address: {
		street: "Via Esempio 12",
		postalCode: "94015",
		city: "Piazza Armerina",
		province: "EN",
	},
	email: "info@example.com",
	phone: "+39 0935 000000",
	reaNumber: "EN-12345",
	shareCapital: "10.000 €",
};
const company = companyInfoSchema.parse(base);
const sole = companyInfoSchema.parse({
	...base,
	legalType: "ditta-individuale",
	reaNumber: undefined,
	shareCapital: undefined,
});
const noEmail = companyInfoSchema.parse({ ...base, email: undefined });
const full = {
	form: true,
	bookingForm: true,
	testimonials: true,
	thirdParties: true,
	mapLink: true,
	prices: true,
	links: { privacy: "/privacy/", cookie: "/cookie/" },
};

const textOf = (sections: LegalSection[]): string =>
	sections
		.flatMap((section) => [
			section.heading,
			...section.blocks.flatMap((block) => {
				switch (block.kind) {
					case "ul":
						return block.items;
					case "facts":
						return block.facts.map((fact) => `${fact.label} ${fact.value}`);
					default:
						return [block.text];
				}
			}),
		])
		.join("\n");
const ids = (sections: LegalSection[]) => sections.map((s) => s.id);
const kinds = (blocks: LegalBlock[]) => blocks.map((b) => b.kind);

it("distingue il testo visibile dalla lista mailto nelle pagine legali", () => {
	const withEmails = { ...company, email: "a@azienda.it,b@azienda.it" };
	for (const language of ["it", "en"] as const) {
		for (const slug of ["privacy", "accessibilita"] as const) {
			const sections = legalSections(slug, language, withEmails, full);
			const facts = sections.flatMap((section) =>
				section.blocks.flatMap((block) =>
					block.kind === "facts" ? block.facts : [],
				),
			);
			const email = facts.find((fact) => fact.href?.startsWith("mailto:"));
			assert.equal(email?.value, "a@azienda.it, b@azienda.it");
			assert.equal(email?.href, "mailto:a@azienda.it,b@azienda.it");
		}
		assert.match(
			textOf(legalSections("note-legali", language, withEmails, full)),
			/a@azienda\.it, b@azienda\.it/,
		);
	}
});

describe("pagine legali: titoli, link e pagine del sito", () => {
	it("ogni lingua ha titolo e descrizione di ogni pagina, non vuoti", () => {
		for (const labels of Object.values(LEGAL_LABELS)) {
			for (const slug of LEGAL_SLUGS) {
				assert.ok(labels.pages[slug].title.trim());
				assert.ok(labels.pages[slug].description.trim());
			}
		}
	});

	it("i link seguono la lingua e i percorsi del sito", () => {
		assert.deepEqual(
			legalLinks("it", config).map((link) => link.href),
			["/privacy/", "/cookie/", "/note-legali/", "/accessibilita/"],
		);
		assert.deepEqual(
			legalLinks("en", config).map((link) => link.href),
			["/en/privacy/", "/en/cookie/", "/en/note-legali/", "/en/accessibilita/"],
		);
	});

	it("entrano tra le pagine del sito in ogni lingua (hreflang)", () => {
		const pages = withLegalPages([], config);
		assert.equal(pages.length, LEGAL_SLUGS.length * 2);
		assert.ok(
			pages.some((p) => p.language === "en" && p.path === "/en/cookie/"),
		);
	});

	it("una pagina dello Studio con uno slug legale è ignorata (vince quella del core) e il log lo dice", (t) => {
		const warn = t.mock.method(console, "warn", () => {});
		const page = {
			id: "x",
			slug: "privacy",
			language: "it" as const,
			path: "/privacy/",
			title: "Mia privacy",
			description: "x",
		};
		const pages = withLegalPages([page], config);
		assert.equal(
			pages.some((p) => p.title === "Mia privacy"),
			false,
		);
		assert.equal(warn.mock.callCount(), 1);
		assert.ok(isLegalSlug("cookie"));
		assert.equal(isLegalSlug("menu"), false);
	});
});

describe("testi legali: completezza e struttura", () => {
	for (const slug of LEGAL_SLUGS) {
		it(`${slug}: sezioni con id unici e testi non vuoti, uguali in struttura in italiano e inglese`, () => {
			const it_ = legalSections(slug, "it", company, full);
			const en = legalSections(slug, "en", company, full);
			assert.ok(it_.length >= 5, `${slug}: poche sezioni`);
			assert.equal(new Set(ids(it_)).size, it_.length, "id duplicati");
			assert.deepEqual(ids(it_), ids(en), "stesse sezioni nelle due lingue");
			it_.forEach((section, index) => {
				assert.deepEqual(
					kinds(section.blocks),
					kinds(en[index]?.blocks ?? []),
					`${slug}/${section.id}: blocchi diversi tra IT e EN`,
				);
			});
			for (const text of [textOf(it_), textOf(en)]) {
				assert.equal(/undefined|\[object/.test(text), false);
			}
			// Nessun testo identico nelle due lingue per i paragrafi lunghi: sarebbe un ripiego sull'italiano.
			const itParagraphs = it_.flatMap((s) =>
				s.blocks.filter((b) => b.kind === "p"),
			) as Array<{ text: string }>;
			const enParagraphs = en.flatMap((s) =>
				s.blocks.filter((b) => b.kind === "p"),
			) as Array<{ text: string }>;
			for (const [index, block] of itParagraphs.entries()) {
				if (block.text.length > 60) {
					assert.notEqual(
						block.text,
						enParagraphs[index]?.text,
						`${slug}: paragrafo non tradotto`,
					);
				}
			}
		});
	}

	it("l'indirizzo dell'ultima modifica è la versione del modello, non la data di build", () => {
		for (const language of ["it", "en"] as const) {
			const text = textOf(legalSections("privacy", language, company, full));
			assert.ok(text.includes(formatDay(LEGAL_MODEL_VERSION, language)));
		}
	});
});

describe("informativa sulla privacy: elementi degli artt. 13-14 GDPR", () => {
	const sections = legalSections("privacy", "it", company, full);
	const text = textOf(sections);

	it("ha tutte le sezioni obbligatorie", () => {
		for (const id of [
			"titolare",
			"dati",
			"finalita",
			"conferimento",
			"modalita",
			"destinatari",
			"trasferimenti",
			"conservazione",
			"diritti",
			"minori",
			"modifiche",
		]) {
			assert.ok(ids(sections).includes(id), `manca ${id}`);
		}
	});

	it("titolare dai dati aziendali, basi giuridiche, diritti, reclamo al Garante", () => {
		assert.ok(text.includes("Ristorante X"));
		assert.ok(text.includes("01234567897"));
		assert.ok(text.includes("info@example.com"));
		assert.ok(text.includes("art. 6, par. 1, lett. b"));
		assert.ok(text.includes("art. 6, par. 1, lett. f"));
		assert.ok(text.includes("Garante per la protezione dei dati personali"));
		for (const art of ["15", "16", "17", "18", "20", "21"]) {
			assert.ok(text.includes(`art. ${art}`), `manca art. ${art}`);
		}
	});

	it("la base del modulo è precontrattuale, non il consenso, e la casella è solo presa visione", () => {
		assert.ok(text.includes("misure precontrattuali"));
		assert.ok(text.includes("non è un consenso al trattamento"));
	});

	it("senza modulo non parla di campi né di prenotazioni", () => {
		const none = textOf(
			legalSections("privacy", "it", company, { form: false }),
		);
		assert.equal(none.includes("modulo"), false);
		assert.equal(none.includes("data, ora"), false);
		assert.equal(none.includes("testimonianz"), false);
		assert.equal(
			ids(legalSections("privacy", "it", company, { form: false })).includes(
				"terzi",
			),
			false,
		);
	});

	it("il modulo di prenotazione elenca data, ora e persone come obbligatori; quello di contatto no", () => {
		const booking = textOf(
			legalSections("privacy", "it", company, {
				form: true,
				bookingForm: true,
			}),
		);
		const contact = textOf(
			legalSections("privacy", "it", company, { form: true }),
		);
		assert.ok(booking.includes("data, ora e numero di persone"));
		assert.equal(contact.includes("numero di persone"), false);
	});

	it("testimonianze e servizi di terzi aggiungono consenso e la sezione dei collegamenti", () => {
		assert.ok(text.includes("consenso (art. 6, par. 1, lett. a"));
		assert.ok(ids(sections).includes("terzi"));
		assert.ok(text.includes("WhatsApp, Instagram, Facebook e TikTok"));
		assert.ok(text.includes("Google Maps"));
		assert.ok(text.includes("non incorpora"));
	});

	it("senza email chiede di indicarne una, invece di inventarla", () => {
		const blocks =
			legalSections("privacy", "it", noEmail, { form: false })[0]?.blocks ?? [];
		assert.ok(blocks.some((b) => b.kind === "todo"));
	});

	it("rimanda alla pagina dei cookie solo se conosce l'indirizzo", () => {
		const withLink =
			legalSections("privacy", "it", company, full)[1]?.blocks ?? [];
		const withoutLink =
			legalSections("privacy", "it", company, { form: true })[1]?.blocks ?? [];
		assert.ok(withLink.some((b) => b.kind === "link" && b.href === "/cookie/"));
		assert.equal(
			withoutLink.some((b) => b.kind === "link"),
			false,
		);
	});
});

describe("informativa sui cookie", () => {
	it("dichiara che il sito non usa cookie, e la dichiarazione coincide con quella che il test e2e verifica", () => {
		assert.deepEqual(DECLARED_STORAGE.cookies, []);
		assert.deepEqual(DECLARED_STORAGE.localStorage, []);
		assert.deepEqual(DECLARED_STORAGE.sessionStorage, []);
		const text = textOf(legalSections("cookie", "it", company, full));
		assert.ok(text.includes("Questo sito non utilizza cookie."));
		assert.ok(text.includes("localStorage"));
		assert.ok(text.includes("art. 122"));
		const en = textOf(legalSections("cookie", "en", company, full));
		assert.ok(en.includes("This site does not use cookies."));
	});

	it("deriva dalla configurazione i marcatori reali e conserva la voce di inventario", () => {
		const cases = [
			[
				{
					antispam: "turnstile",
					forms: { turnstileSiteKey: "SyntheticPublicSiteKey123" },
				},
				["turnstile"],
				/widget.*Turnstile|Turnstile widget/,
			],
			[{ analytics: "cloudflare" }, ["analytics"], /Cloudflare Web Analytics/],
			[
				{
					antispam: "turnstile",
					analytics: "cloudflare",
					forms: { turnstileSiteKey: "SyntheticPublicSiteKey123" },
				},
				["turnstile", "analytics"],
				/Cloudflare Web Analytics/,
			],
		] as const;
		for (const [modules, expected, textPattern] of cases) {
			const configured = parseSiteConfig({ ...config, modules });
			const features = resolveLegalFeatures(configured, full);
			assert.equal(features.form, true);
			assert.equal(
				features.antispam,
				expected.some((tool) => tool === "turnstile"),
			);
			assert.equal(
				features.analytics,
				expected.some((tool) => tool === "analytics"),
			);
			for (const language of config.languages) {
				const sections = legalSections(
					"cookie",
					language,
					company,
					full,
					configured,
				);
				const blocks = sections.flatMap((section) => section.blocks);
				assert.deepEqual(
					blocks.flatMap((block) =>
						block.kind === "p" && block.cookieTool ? [block.cookieTool] : [],
					),
					expected,
				);
				assert.match(textOf(sections), textPattern);
				assert.doesNotMatch(
					textOf(sections),
					/è protetto|is protected|non utilizza cookie|does not use cookies/i,
				);
				assert.ok(
					blocks.some((block) => block.kind === "todo"),
					"voce todo dell'inventario",
				);
				assert.doesNotMatch(
					textOf(legalSections("privacy", language, company, full, configured)),
					/non usa cookie né|uses no cookies/i,
				);
			}
		}
	});

	it("cita i servizi di terzi solo se il sito li linka", () => {
		assert.ok(
			ids(legalSections("cookie", "it", company, full)).includes("terzi"),
		);
		assert.equal(
			ids(legalSections("cookie", "it", company, { form: false })).includes(
				"terzi",
			),
			false,
		);
	});
});

describe("note legali: art. 7 del D.Lgs. 70/2003", () => {
	const todos = (
		c: typeof company,
		features: LegalFeatures = { form: false },
	) =>
		(legalSections("note-legali", "it", c, features)[0]?.blocks ?? []).filter(
			(b) => b.kind === "todo",
		);

	it("i dati dell'attività stanno nei fatti; REA e capitale solo se ci sono", () => {
		const blocks =
			legalSections("note-legali", "it", company, { form: false })[0]?.blocks ??
			[];
		const facts = blocks.find((b) => b.kind === "facts");
		const labels =
			facts?.kind === "facts" ? facts.facts.map((f) => f.label) : [];
		for (const label of [
			"Denominazione",
			"Sede",
			"Partita IVA",
			"Numero REA",
			"Capitale sociale",
			"Email",
		]) {
			assert.ok(labels.includes(label), label);
		}
		const soleBlocks =
			legalSections("note-legali", "it", sole, { form: false })[0]?.blocks ??
			[];
		const soleFacts = soleBlocks.find((b) => b.kind === "facts");
		const soleLabels =
			soleFacts?.kind === "facts" ? soleFacts.facts.map((f) => f.label) : [];
		assert.equal(soleLabels.includes("Numero REA"), false);
	});

	it("ciò che il sito non sa (registro delle imprese, autorizzazioni, prezzi) è una voce da completare", () => {
		assert.ok(
			todos(sole).some(
				(b) => b.kind === "todo" && b.text.includes("registro delle imprese"),
			),
		);
		assert.equal(
			todos(company).some(
				(b) => b.kind === "todo" && b.text.includes("registro delle imprese"),
			),
			false,
		);
		assert.ok(
			todos(company).some(
				(b) => b.kind === "todo" && b.text.includes("autorizzazioni"),
			),
		);
		assert.equal(
			todos(company).some(
				(b) => b.kind === "todo" && b.text.includes("prezzi"),
			),
			false,
		);
		assert.ok(
			todos(company, { form: false, prices: true }).some(
				(b) => b.kind === "todo" && b.text.includes("prezzi"),
			),
		);
	});

	it("per un professionista chiede l'ordine di appartenenza", () => {
		const pro = companyInfoSchema.parse({
			...base,
			legalType: "professionista",
			reaNumber: undefined,
			shareCapital: undefined,
		});
		assert.ok(
			todos(pro).some(
				(b) => b.kind === "todo" && b.text.includes("ordine o collegio"),
			),
		);
	});

	it("ha utilizzo, proprietà intellettuale, responsabilità, legge applicabile (art. 66-bis per i consumatori)", () => {
		const text = textOf(
			legalSections("note-legali", "it", company, { form: false }),
		);
		for (const part of [
			"Proprietà intellettuale",
			"Limitazione di responsabilità",
			"foro",
			"66-bis",
			"633/1941",
		]) {
			assert.ok(text.includes(part), part);
		}
	});
});

describe("accessibilità", () => {
	it("dichiara solo ciò che i test coprono e dice che non basta", () => {
		const text = textOf(
			legalSections("accessibilita", "it", company, { form: false }),
		);
		assert.ok(text.includes("WCAG) 2.2 al livello AA"));
		assert.ok(text.includes("axe-core"));
		assert.ok(text.includes("non sostituiscono una valutazione manuale"));
		assert.ok(text.includes("possiamo quindi escludere"));
		assert.ok(text.includes("Direttiva (UE) 2019/882"));
		assert.ok(text.includes("ove applicabile"));
	});

	it("il canale di segnalazione è l'email, se c'è", () => {
		const withEmail = legalSections("accessibilita", "it", company, {
			form: false,
		});
		const segn = withEmail.find((s) => s.id === "segnalazioni");
		assert.ok(
			segn?.blocks.some(
				(b) => b.kind === "facts" && b.facts[0]?.href?.startsWith("mailto:"),
			),
		);
		const without = legalSections("accessibilita", "it", noEmail, {
			form: false,
		}).find((s) => s.id === "segnalazioni");
		assert.equal(
			without?.blocks.some((b) => b.kind === "facts"),
			false,
		);
		assert.ok(textOf(without ? [without] : []).includes("indirizzo email"));
	});
});

describe("stato di bozza", () => {
	it("finché il modello non è rivisto le pagine sono una bozza; cambiando la costante il marcatore sparisce", () => {
		assert.equal(LEGAL_MODEL_REVIEWED, false);
		assert.equal(legalDraft(), true);
		assert.equal(legalDraft(false), true);
		assert.equal(legalDraft(true), false);
	});
});
