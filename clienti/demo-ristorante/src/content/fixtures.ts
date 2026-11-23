import { addDays } from "@siti/core/content/holidays.ts";
import { localDateTime } from "@siti/core/content/opening-status.ts";

/**
 * Contenuti INVENTATI di "Azienda X" (attività di prova, nessuna persona o impresa reale):
 * dati grezzi, nella stessa forma che restituiscono le query GROQ dello Studio. Sono la sorgente
 * `fixtures` di `source.ts` (la predefinita, senza rete) e valgono solo per i siti `prova` e
 * `demo-*`. Solo dati: nessun import dagli altri file dei contenuti (evita cicli con `source.ts`).
 *
 * La partita IVA è un numero inventato ma valido (11 cifre e cifra di controllo). La
 * valutazione e il link della home sono finti: `example.com` è un dominio riservato. La foto
 * principale e quelle della galleria sono segnaposto locali e non stanno qui.
 */

/** Oggi alla build: le date vicine del demo (chiusure, avvisi, promozioni) si scrivono nell'HTML. */
const today = localDateTime(new Date()).date;

const lunchAndDinner = {
	intervals: [
		{ opens: "12:00", closes: "15:00" },
		{ opens: "19:00", closes: "23:00" },
	],
};

export const company = {
	name: "Azienda X",
	legalType: "ditta-individuale",
	vatNumber: "01234567897",
	address: {
		street: "Via Esempio 1",
		postalCode: "00000",
		city: "Città 1",
		province: "XX",
	},
	phone: "+39 000 000 0000",
	email: "info@azienda-x.example",
};

/**
 * Orari: chiuso il lunedì; una chiusura già passata (per provare che il browser la nasconde) e
 * una pausa estiva futura; chiuso a Natale e nel giorno del patrono (scelte del titolare).
 */
export const hours = {
	monday: { closed: true },
	tuesday: lunchAndDinner,
	wednesday: lunchAndDinner,
	thursday: lunchAndDinner,
	friday: lunchAndDinner,
	saturday: lunchAndDinner,
	sunday: { intervals: [{ opens: "12:00", closes: "15:00" }] },
	closures: [
		{
			from: "2026-01-05",
			to: "2026-01-07",
			reason: { it: "Motivo 1", en: "Reason 1" },
		},
		// Sempre vicina alla build: il browser la nasconde quando è passata (prova in e2e).
		{
			from: addDays(today, 3),
			to: addDays(today, 4),
			reason: { it: "Motivo 2", en: "Reason 2" },
		},
		{
			from: "2027-08-16",
			to: "2027-08-31",
			reason: { it: "Motivo 3", en: "Reason 3" },
		},
	],
	closedHolidays: ["christmas"],
	patronSaintDay: { day: 15, month: 8 },
};

export const home = {
	title: { it: "Azienda X", en: "Azienda X" },
	description: {
		it: "Descrizione 1 di Azienda X.",
		en: "Description 1 of Azienda X.",
	},
	heroTitle: {
		it: "Titolo 1",
		en: "Title 1",
	},
	heroSubtitle: {
		it: "Sottotitolo 1",
		en: "Subtitle 1",
	},
	storyTitle: { it: "Titolo 2", en: "Title 2" },
	storyText: {
		it: "Testo 1",
		en: "Text 1",
	},
	socialProof: {
		rating: 4.7,
		reviewCount: 120,
		sourceName: "Google",
		// Ricerca dell'attività su Google Maps (formato documentato); il titolare ci mette il link vero, alla
		// sezione delle recensioni della sua scheda.
		sourceUrl: "https://www.google.com/maps/search/?api=1&query=Azienda%20X",
	},
};

/** Le pagine `page` (la home è il documento `home`): menu, galleria, contatti (le pagine legali sono del core, non dello Studio). */
export const pages = [
	{
		_id: "page-menu",
		slug: "menu",
		title: { it: "Menu", en: "Menu" },
		description: {
			it: "Descrizione 2 di Azienda X.",
			en: "Description 2 of Azienda X.",
		},
	},
	{
		_id: "page-galleria",
		slug: "galleria",
		title: { it: "Galleria", en: "Gallery" },
		description: {
			it: "Descrizione 3 di Azienda X.",
			en: "Description 3 of Azienda X.",
		},
	},
	{
		_id: "page-chi-siamo",
		slug: "chi-siamo",
		title: { it: "Chi siamo", en: "About us" },
		description: {
			it: "Descrizione 4 di Azienda X.",
			en: "Description 4 of Azienda X.",
		},
	},
	{
		_id: "page-contatti",
		slug: "contatti",
		title: { it: "Contatti e prenotazioni", en: "Contact and booking" },
		description: {
			it: "Descrizione 5 di Azienda X.",
			en: "Description 5 of Azienda X.",
		},
	},
];

/**
 * Avvisi e promozioni: l'avviso urgente è solo in italiano per scelta del titolare («Pubblica
 * solo in Italiano»); la promozione «solo italiano» ha l'inglese compilato ma non compare in inglese.
 */
/**
 * Avvisi del giorno: nessuno. Un avviso con il testo vuoto NON sparisce, ferma la build (il messaggio
 * è obbligatorio, come nello Studio); la barra gialla non compare quando non ci sono avvisi validi.
 * `exampleNotices` conserva i due avvisi di prova (uno solo in italiano per scelta del titolare):
 * per riaccendere la barra basta usarli al posto di `[]`.
 */
export const notices: unknown[] = [];

export const exampleNotices = [
	{
		_id: "avviso-festa",
		message: {
			it: "Avviso 1",
			en: "Notice 1",
		},
		validFrom: today,
		validTo: addDays(today, 1),
	},
	{
		_id: "avviso-urgente",
		message: { it: "Avviso 2" },
		validTo: addDays(today, 1),
		onlyDefaultLanguage: true,
	},
];

export const promotions = [
	{
		_id: "promo-pranzo",
		title: { it: "Promozione 1", en: "Offer 1" },
		description: {
			it: "Descrizione promozione 1",
			en: "Offer description 1",
		},
		validTo: addDays(today, 30),
		link: "https://example.com/prenota",
	},
	{
		_id: "promo-serata",
		title: { it: "Promozione 2", en: "Offer 2" },
		description: {
			it: "Descrizione promozione 2",
			en: "Offer description 2",
		},
		validTo: addDays(today, 2),
		onlyDefaultLanguage: true,
	},
];

export const menu = {
	// Il primo menu (Pizzeria): le sezioni dirette del documento, con il suo nome.
	mainTitle: { it: "Pizzeria", en: "Pizzeria" },
	// Tipi di cucina dichiarati dal titolare (valori di schema.org).
	cuisine: ["Sicilian", "Pizza"],
	sections: [
		{
			title: { it: "Pizze", en: "Pizzas" },
			items: [
				{
					name: "Voce 1",
					description: { it: "Descrizione pizza 1", en: "Pizza description 1" },
					price: 7,
					diet: "vegetarian",
					allergens: ["gluten", "milk"],
					allergensVerified: true,
				},
				{
					name: "Voce 2",
					description: { it: "Descrizione voce 2", en: "Item description 2" },
					price: 9,
					featured: true,
					allergens: ["gluten", "milk"],
					allergensVerified: true,
				},
				{
					name: "Voce 3",
					description: { it: "Descrizione voce 3", en: "Item description 3" },
					price: 10,
					diet: "vegetarian",
				},
			],
		},
		{
			title: { it: "Bevande", en: "Drinks" },
			items: [
				{
					name: "Voce 4",
					price: 2.5,
					allergens: [],
					allergensVerified: true,
				},
				{
					name: "Voce 5",
					price: 5,
					allergens: ["gluten"],
					allergensVerified: true,
				},
			],
		},
	],
	// Gli altri menu (qui il Ristorante), ognuno con il suo nome e le sue sezioni.
	groups: [
		{
			title: { it: "Ristorante", en: "Restaurant" },
			description: { it: "Descrizione gruppo 2", en: "Group description 2" },
			sections: [
				{
					title: { it: "Primi", en: "First courses" },
					items: [
						{
							name: "Voce 6",
							description: {
								it: "Descrizione primo 6",
								en: "First course description 6",
							},
							components: [
								{ it: "Componente 1", en: "Component 1" },
								{ it: "Componente 2", en: "Component 2" },
								{ it: "Componente 3", en: "Component 3" },
							],
							price: 14,
							diet: "vegetarian",
							allergens: ["gluten", "eggs", "milk"],
							allergensVerified: true,
						},
						{
							name: "Voce 7",
							description: {
								it: "Descrizione voce 7",
								en: "Item description 7",
							},
							components: [
								{ it: "Componente 4", en: "Component 4" },
								{ it: "Componente 5", en: "Component 5" },
								{ it: "Componente 6", en: "Component 6" },
							],
							price: 13,
							featured: true,
							diet: "vegetarian",
						},
					],
				},
				{
					title: { it: "Secondi", en: "Main courses" },
					items: [
						{
							name: "Voce 8",
							description: {
								it: "Descrizione voce 8",
								en: "Item description 8",
							},
							price: 22,
							allergens: ["fish"],
						},
					],
				},
				{
					title: { it: "Dolci", en: "Desserts" },
					items: [
						{
							name: "Voce 9",
							description: {
								it: "Descrizione voce 9",
								en: "Item description 9",
							},
							price: 6,
							diet: "vegetarian",
							allergens: ["gluten", "milk", "eggs"],
							allergensVerified: true,
						},
					],
				},
			],
		},
	],
};

/**
 * Nessun link di prenotazione esterno: «Prenota» porta al modulo del sito. WhatsApp e profili social
 * sono segnaposto (numero fittizio, pagine iniziali dei servizi): nessun profilo vero.
 */
export const contacts = {
	whatsapp: "+39 000 000 0000",
	instagramUrl: "https://www.instagram.com/",
	facebookUrl: "https://www.facebook.com/",
	tiktokUrl: "https://www.tiktok.com/",
};

/** Domande frequenti (inventate). Il titolo dell'invito in fondo è quello del core. */
export const faq = {
	title: { it: "Titolo 3", en: "Title 3" },
	subtitle: {
		it: "Sottotitolo 2",
		en: "Subtitle 2",
	},
	items: [
		{
			question: { it: "Domanda 1", en: "Question 1" },
			answer: { it: "Risposta 1", en: "Answer 1" },
		},
		{
			question: { it: "Domanda 2", en: "Question 2" },
			answer: { it: "Risposta 2", en: "Answer 2" },
		},
		{
			question: { it: "Domanda 3", en: "Question 3" },
			answer: { it: "Risposta 3", en: "Answer 3" },
		},
		{
			question: { it: "Domanda 4", en: "Question 4" },
			answer: { it: "Risposta 4", en: "Answer 4" },
		},
		{
			question: { it: "Domanda 5", en: "Question 5" },
			answer: { it: "Risposta 5", en: "Answer 5" },
		},
		{
			question: { it: "Domanda 6", en: "Question 6" },
			answer: { it: "Risposta 6", en: "Answer 6" },
		},
	],
};

/** Testimonianze (inventate). L'ultima è solo in italiano: in inglese si vede l'originale con `lang="it"`. */
export const testimonials = [
	{
		_id: "testimonial-giulia",
		author: "X1",
		role: { it: "Ruolo 1", en: "Role 1" },
		rating: 5,
		text: { it: "Testimonianza 1", en: "Testimonial 1" },
	},
	{
		_id: "testimonial-marco",
		author: "X2",
		role: { it: "Ruolo 2", en: "Role 2" },
		rating: 5,
		text: { it: "Testimonianza 2", en: "Testimonial 2" },
	},
	{
		_id: "testimonial-elena",
		author: "X3",
		rating: 4,
		text: { it: "Testimonianza 3" },
	},
];
