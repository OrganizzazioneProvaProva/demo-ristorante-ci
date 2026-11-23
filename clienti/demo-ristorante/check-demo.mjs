// Controllo minimo del sito demo: la pagina esiste, ha lingua e titolo.
// Le sezioni, la home e le lingue arrivano nei passi successivi.
import { readFileSync } from "node:fs";
import { checkDistMutations } from "../../core/src/checks/dist-mutations.ts";

const demoOrigin = "https://demo.edordopng.dev";
const html = readFileSync(
	new URL("./dist/index.html", import.meta.url),
	"utf8",
);
const problems = [];
// The canonical fixture exercises fixed menu values. Editorial builds check the snapshot.
const fixtureMenu = !process.argv.includes("--editorial-menu");
if (!/<html[^>]*\slang="it"/.test(html))
	problems.push('manca <html lang="it">');
if (!/<title>[^<]+<\/title>/.test(html))
	problems.push("manca un <title> non vuoto");
if (!/<meta name="description" content="[^"]+"/.test(html)) {
	problems.push("manca la meta description");
}

// L'immagine in cima alla pagina (hero) è prioritaria: eager, sync, fetchpriority alta.
const hero = /<img\b[^>]*>/.exec(html)?.[0] ?? "";
if (hero === "") {
	problems.push("manca l'immagine dell'hero");
} else if (!/fetchpriority=["']?high/.test(hero)) {
	problems.push(
		"l'hero non ha fetchpriority=high (manca `priority` su SiteImage)",
	);
}

// Il piè di pagina scrive CAP, città e provincia con gli spazi (un a capo del sorgente li perderebbe).
if (!html.includes("00000 Città 1 (XX)")) {
	problems.push(
		"nel piè di pagina manca «00000 Città 1 (XX)» scritto con gli spazi",
	);
}

// Menu: gruppi con ancore uguali nelle due lingue, allergeni nella lingua, invito per i non verificati,
// prezzi nel formato della lingua, azione "Menu" nella barra e hreflang tra le due pagine.
const menuIt = readFileSync(
	new URL("./dist/menu/index.html", import.meta.url),
	"utf8",
);
const menuEn = readFileSync(
	new URL("./dist/en/menu/index.html", import.meta.url),
	"utf8",
);
const expectIn = (page, label, needles) => {
	for (const needle of needles) {
		const found =
			needle instanceof RegExp ? needle.test(page) : page.includes(needle);
		if (!found) problems.push(`${label}: manca ${needle}`);
	}
};
expectIn(menuIt, "menu IT", [
	'aria-current="page"',
	'href="/menu/"',
	`hreflang="en" href="${demoOrigin}/en/menu/"`,
]);
if (fixtureMenu) {
	expectIn(menuIt, "menu IT fixture", [
		'id="pizzeria"',
		'id="ristorante"',
		'href="#pizzeria"',
		"Allergeni: Cereali contenenti glutine, Latte e lattosio",
		"Chiedi informazioni sugli allergeni al personale.",
		/7,00\s€/,
	]);
}
expectIn(menuEn, "menu EN", [
	'href="/en/menu/"',
	`hreflang="it" href="${demoOrigin}/menu/"`,
]);
if (fixtureMenu) {
	expectIn(menuEn, "menu EN fixture", [
		'id="pizzeria"',
		'id="ristorante"',
		"Allergens: Cereals containing gluten, Milk (including lactose)",
		"Please ask our staff for allergen information.",
		/€7\.00/,
	]);
}
if (fixtureMenu && menuEn.includes("Chiedi informazioni")) {
	problems.push("menu EN: contiene testo italiano (nessun ripiego)");
}

// Orari: la settimana è nell'HTML (leggibile senza JavaScript), nella lingua; le chiusure già finite non si scrivono.
const homeEn = readFileSync(
	new URL("./dist/en/index.html", import.meta.url),
	"utf8",
);
expectIn(html, "home IT orari", [
	"Orari di apertura",
	"Lunedì",
	"Chiuso",
	"12:00–15:00, 19:00–23:00",
	"data-open-status",
	"Motivo 3",
]);
expectIn(homeEn, "home EN orari", [
	"Opening hours",
	"Monday",
	"Closed",
	"Reason 3",
]);
if (html.includes("Motivo 1")) {
	problems.push(
		"home IT: la chiusura già finita («Motivo 1», gennaio 2026) non deve essere scritta",
	);
}

// Avvisi, promozioni e galleria: l'avviso urgente e la promozione «solo italiano» non sono in inglese;
// la galleria ha le foto con il testo alternativo nella lingua.
const galleryIt = readFileSync(
	new URL("./dist/galleria/index.html", import.meta.url),
	"utf8",
);
const galleryEn = readFileSync(
	new URL("./dist/en/galleria/index.html", import.meta.url),
	"utf8",
);
// Nessun avviso del giorno nel demo (vedi `notices` in fixtures.ts): la barra gialla non compare.
if (
	html.includes('aria-label="Avvisi"') ||
	homeEn.includes('aria-label="Notices"')
) {
	problems.push("home: senza avvisi non deve comparire la barra degli avvisi");
}
expectIn(html, "home IT promozioni", [
	"Promozione 1",
	"Promozione 2",
	"data-valid-to",
	'aria-label="Foto del locale: scorri per vederle tutte"',
]);
expectIn(homeEn, "home EN promozioni", ["Offer 1", "Offers"]);
for (const italianOnly of ["Avviso 2", "Promozione 2", "Offer 2"]) {
	if (homeEn.includes(italianOnly)) {
		problems.push(
			`home EN: «${italianOnly}» non deve comparire (pubblicato solo nella lingua principale)`,
		);
	}
}
expectIn(galleryIt, "galleria IT", [
	"Foto 2 di Azienda X",
	"Foto 7 di Azienda X",
	"<h1",
]);
expectIn(galleryEn, "galleria EN", [
	"Photo 2 of Azienda X",
	"Photo 7 of Azienda X",
]);
if ((galleryIt.match(/<h[12]\b/g) ?? []).length !== 1) {
	problems.push(
		"galleria IT: il titolo deve comparire una volta sola (h1 della pagina, nessun h2 doppio)",
	);
}
// 6 foto a blocchi, ognuna è un link all'immagine intera (funziona anche senza JavaScript), più la finestra
// dell'ingrandimento con un'immagine vuota (riempita dallo script).
if ((galleryIt.match(/data-lightbox-open/g) ?? []).length !== 6) {
	problems.push("galleria IT: devono esserci 6 foto ingrandibili");
}
if ((galleryIt.match(/<img\b/g) ?? []).length !== 7) {
	problems.push("galleria IT: 6 foto più l'immagine della finestra");
}
expectIn(galleryIt, "galleria IT blocchi", [
	"data-mosaic",
	"<dialog",
	'aria-label="Ingrandisci la foto 1 di 6"',
	'aria-label="Chiudi la foto ingrandita"',
]);
expectIn(galleryEn, "galleria EN blocchi", [
	'aria-label="Enlarge photo 1 of 6"',
	'aria-label="Close the enlarged photo"',
]);

// JSON-LD: JSON valido nella home (IT e EN), con indirizzo assoluto della lingua, cucina, menu, coordinate e orari.
const ldOf = (page) => {
	const match =
		/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(page);
	return match ? JSON.parse(match[1]) : undefined;
};
for (const [label, page, url, menuUrl] of [
	["IT", html, `${demoOrigin}/`, `${demoOrigin}/menu/`],
	["EN", homeEn, `${demoOrigin}/en/`, `${demoOrigin}/en/menu/`],
]) {
	const ld = ldOf(page);
	if (!ld) {
		problems.push(`home ${label}: manca il JSON-LD`);
		continue;
	}
	const checks = [
		[ld["@type"] === "Restaurant", "@type Restaurant"],
		[ld.url === url, `url ${url}`],
		[ld["@id"] === `${demoOrigin}/#business`, "@id uguale in ogni lingua"],
		[ld.menu === menuUrl, `menu ${menuUrl}`],
		[
			ld.name === "Azienda X" && ld.vatID === "IT01234567897",
			"nome e partita IVA",
		],
		[ld.address?.addressLocality === "Città 1", "indirizzo"],
		[ld.geo?.latitude === 37.3856, "coordinate"],
		[
			!fixtureMenu ||
				JSON.stringify(ld.servesCuisine) === '["Sicilian","Pizza"]',
			"servesCuisine",
		],
		[
			ld.openingHoursSpecification?.some(
				(spec) =>
					spec.opens === "12:00" &&
					spec.closes === "15:00" &&
					spec.dayOfWeek.length === 6,
			),
			"orari del pranzo (martedì-domenica)",
		],
		[
			ld.openingHoursSpecification?.some(
				(spec) => spec.validFrom && spec.opens === "00:00",
			),
			"chiusura straordinaria",
		],
		[
			typeof ld.acceptsReservations === "string" &&
				ld.acceptsReservations.startsWith("https://") &&
				ld.acceptsReservations.includes("/contatti/"),
			"acceptsReservations assoluto verso la pagina Contatti",
		],
		[
			!("aggregateRating" in ld) && !("image" in ld) && !("priceRange" in ld),
			"nessun dato inventato",
		],
	];
	for (const [ok, what] of checks)
		if (!ok) problems.push(`home ${label}: JSON-LD senza ${what}`);
}
if (menuIt.includes("application/ld+json"))
	problems.push("la pagina del menu non deve avere il JSON-LD dell'attività");

// Ricerca nel menu: casella nascosta finché non parte lo script, elementi con il testo di ricerca nella lingua.
expectIn(menuIt, "menu IT ricerca", ["data-catalog-search", "Cerca nel menu"]);
expectIn(menuEn, "menu EN ricerca", ["data-catalog-search", "Search the menu"]);
// Contenuti della fixture verificati nella scheda e nel testo di ricerca.
if (fixtureMenu) {
	expectIn(menuIt, "menu IT testo di ricerca", [
		/data-search="[^"]*descrizione pizza 1/,
	]);
	expectIn(menuIt, "menu IT componenti", [
		"Componenti: Componente 4, Componente 5, Componente 6",
		/data-search="[^"]*componente 5/,
	]);
	expectIn(menuEn, "menu EN componenti", [
		"Components: Component 4, Component 5, Component 6",
	]);
}
if (
	!/<div\s[^>]*hidden[^>]*data-catalog-search|data-catalog-search[^>]*\shidden/.test(
		menuIt,
	)
)
	problems.push(
		"menu IT: la casella di ricerca deve essere nascosta nell'HTML",
	);

// Mappa segnaposto nella pagina Contatti: link a Google Maps, marcata come segnaposto.
for (const [lang, base, open] of [
	["IT", "contatti", "Apri la mappa"],
	["EN", "en/contatti", "Open the map"],
]) {
	const page = readFileSync(
		new URL(`./dist/${base}/index.html`, import.meta.url),
		"utf8",
	);
	expectIn(page, `contatti ${lang} mappa`, [
		"data-placeholder",
		"https://www.google.com/maps/search/",
		open,
	]);
}

// FAQ e testimonianze nella home: righe numerate nella lingua, stelle con testo alternativo, testo
// originale con lang quando manca la traduzione, invito a scrivere con l'email in fondo.
const homeIt = readFileSync(
	new URL("./dist/index.html", import.meta.url),
	"utf8",
);
expectIn(homeIt, "home IT faq", [
	'id="faq"',
	"Titolo 3",
	"Domanda 1",
	"Hai ancora dubbi?",
	'href="mailto:info@azienda-x.example"',
	'aria-label="5 su 5"',
	"Cosa dicono i nostri clienti",
]);
expectIn(homeEn, "home EN faq", [
	"Title 3",
	"Question 1",
	"Still have questions?",
	'aria-label="5 out of 5"',
	"What our customers say",
	/<blockquote lang="it"[^>]*>\s*<p>Testimonianza 3/,
]);
if ((homeIt.match(/<details/g) ?? []).length !== 6)
	problems.push("home IT: le FAQ devono essere 6");
if ((homeEn.match(/<details/g) ?? []).length !== 6)
	problems.push("home EN: le FAQ devono essere 6");
if (
	(homeIt.match(/<details\s+name="faq"\s+data-card\s+open[\s>]/g) ?? [])
		.length !== 1
)
	problems.push("home IT: solo la prima FAQ deve essere aperta");

// Piè di pagina: WhatsApp e profili social come link, nome in grande (nessun logo nel demo).
expectIn(homeIt, "home IT piè di pagina", [
	"data-contact-links",
	'href="https://wa.me/390000000000"',
	'href="https://www.instagram.com/"',
	'href="https://www.facebook.com/"',
	'href="https://www.tiktok.com/"',
	"text-4xl",
	'aria-label="Pagine"',
	"Seguici",
]);
// Galleria a ventaglio nella home: una regione con le foto come diapositive etichettate.
expectIn(homeIt, "home IT ventaglio", [
	"data-fan-viewport",
	'aria-roledescription="carosello"',
	'aria-roledescription="diapositiva"',
	'aria-label="Foto 1 di 6"',
	'aria-label="Foto precedente"',
]);
expectIn(homeEn, "home EN ventaglio", [
	'aria-roledescription="carousel"',
	'aria-roledescription="slide"',
	'aria-label="Photo 1 of 6"',
	'aria-label="Next photo"',
]);
if ((homeIt.match(/data-fan-slide/g) ?? []).length !== 6)
	problems.push("home IT: il ventaglio deve avere 6 foto");

// Chi siamo: storia, dove siamo con il segnaposto della mappa e orari; è nella navigazione.
const aboutIt = readFileSync(
	new URL("./dist/chi-siamo/index.html", import.meta.url),
	"utf8",
);
const aboutEn = readFileSync(
	new URL("./dist/en/chi-siamo/index.html", import.meta.url),
	"utf8",
);
expectIn(aboutIt, "chi siamo IT", [
	"<h1",
	"Chi siamo",
	"Titolo 2",
	"Dove siamo",
	"data-placeholder",
	"Orari di apertura",
	'href="/chi-siamo/"',
]);
expectIn(aboutEn, "chi siamo EN", [
	"About us",
	"Title 2",
	"Where to find us",
	"Opening hours",
	'href="/en/chi-siamo/"',
]);

// Pagine legali: modelli completi (non solo segnaposto), con indice, elementi dell'art. 13 GDPR e dati dell'attività.
const privacyIt = readFileSync(
	new URL("./dist/privacy/index.html", import.meta.url),
	"utf8",
);
const privacyEn = readFileSync(
	new URL("./dist/en/privacy/index.html", import.meta.url),
	"utf8",
);
expectIn(privacyIt, "privacy IT", [
	"Titolare del trattamento",
	/Diritti dell(?:'|&#39;)interessato/,
	"Garante per la protezione dei dati personali",
	"misure precontrattuali",
	'aria-label="Indice della pagina"',
	'href="#diritti"',
	"Bozza: questo testo è un modello generico",
	"data-legal-placeholder",
	"01234567897",
	'href="/cookie/"',
]);
expectIn(privacyEn, "privacy EN", [
	"Data controller",
	"Your rights",
	"lodge a complaint",
	"Draft: this text is a generic model",
	'aria-label="On this page"',
]);
expectIn(
	readFileSync(new URL("./dist/cookie/index.html", import.meta.url), "utf8"),
	"cookie IT",
	['data-cookie-tool="none"', "Questo sito non utilizza cookie.", "art. 122"],
);
expectIn(
	readFileSync(new URL("./dist/en/cookie/index.html", import.meta.url), "utf8"),
	"cookie EN",
	['data-cookie-tool="none"', "This site does not use cookies."],
);
expectIn(
	readFileSync(
		new URL("./dist/note-legali/index.html", import.meta.url),
		"utf8",
	),
	"note legali IT",
	["art. 7 del D.Lgs. 70/2003", "Da completare:", "66-bis"],
);
expectIn(
	readFileSync(
		new URL("./dist/accessibilita/index.html", import.meta.url),
		"utf8",
	),
	"accessibilità IT",
	["WCAG) 2.2 al livello AA", "axe-core", "info@azienda-x.example"],
);

// Viste del menu: due gruppi (Pizzeria, Ristorante) come pannelli, con i pulsanti che li scelgono.
if (fixtureMenu) {
	expectIn(menuIt, "menu IT viste", [
		"data-catalog-views",
		"data-view-button",
		/<section[^>]*id="pizzeria"[^>]*data-view-panel/,
		/<section[^>]*id="ristorante"[^>]*data-view-panel/,
	]);
}

// Contatti e prenotazioni: il modulo ha i campi di prenotazione nella lingua, il link all'informativa
// accanto al pulsante di invio, l'indirizzo segnaposto (.invalid) e la pagina privacy esiste;
// la home non ha il pulsante «Prenota» (né nell'hero né nella barra: solo Mappa e Chiama); il modulo si raggiunge dai Contatti.
for (const [lang, base, submit, label, privacy, book] of [
	[
		"IT",
		"contatti",
		"Invia la richiesta",
		"Numero di persone",
		"/privacy/",
		"/contatti/#prenota",
	],
	[
		"EN",
		"en/contatti",
		"Send the request",
		"Number of guests",
		"/en/privacy/",
		"/en/contatti/#prenota",
	],
]) {
	const page = readFileSync(
		new URL(`./dist/${base}/index.html`, import.meta.url),
		"utf8",
	);
	expectIn(page, `contatti ${lang}`, [
		'id="prenota"',
		'action="https://form.invalid/richiesta"',
		'method="post"',
		submit,
		label,
		`href="${privacy}"`,
		'type="checkbox"',
		'type="date"',
		'type="time"',
	]);
	const home = readFileSync(
		new URL(`./dist/${lang === "IT" ? "" : "en/"}index.html`, import.meta.url),
		"utf8",
	);
	if (home.includes(`href="${book}"`)) {
		problems.push(
			`home ${lang}: non deve avere il pulsante «Prenota» (${book})`,
		);
	}
	readFileSync(
		new URL(
			`./dist/${lang === "IT" ? "" : "en/"}privacy/index.html`,
			import.meta.url,
		),
		"utf8",
	);
}

for (const [folder, title] of [
	["", "Pagina non trovata"],
	["en/", "Page not found"],
]) {
	const missing = readFileSync(
		new URL(`./dist/${folder}404.html`, import.meta.url),
		"utf8",
	);
	expectIn(missing, `404 ${folder || "IT"}`, [
		title,
		`href="/${folder}"`,
		`href="/${folder}contatti/"`,
	]);
}

if (problems.length > 0) {
	console.error(`FAIL: ${problems.join("; ")}`);
	process.exit(1);
}
console.log("OK: dist/index.html ha lingua, titolo e description");

checkDistMutations(new URL(".", import.meta.url), false);
