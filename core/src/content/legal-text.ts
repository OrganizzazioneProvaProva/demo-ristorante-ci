import {
	analyticsMode,
	antispamMode,
	companyEmailContact,
	type Language,
	type LegalSlug,
	type SiteConfig,
} from "@siti/config";
import type { CompanyInfo } from "./company.ts";
import { LEGAL_LABELS } from "./legal.ts";
import { formatDay } from "./section-labels.ts";

/**
 * Testi delle quattro pagine obbligatorie (privacy, cookie, note legali, accessibilità): MODELLI
 * GENERICI per il caso base, nello stile delle informative dei generatori più diffusi, con gli
 * elementi che la normativa italiana ed europea richiede a ogni sito:
 * - informativa privacy: artt. 13 e 14 del Regolamento (UE) 2016/679 (GDPR);
 * - cookie: art. 122 del Codice privacy (D.Lgs. 196/2003) e Linee guida del Garante sui cookie;
 * - note legali: art. 7 del D.Lgs. 70/2003 (informazioni generali obbligatorie);
 * - accessibilità: Direttiva (UE) 2019/882 (European Accessibility Act), ove applicabile.
 *
 * Descrivono SOLO ciò che il sito fa: nessun cookie né memorizzazione nel browser (lo verifica il
 * test e2e), caratteri e immagini serviti dal sito stesso, collegamenti (non incorporamenti) a
 * mappe, WhatsApp e social, dati dei moduli inviati per email e non conservati dal sito. Il testo si
 * adatta alle funzioni attive (`LegalFeatures`); ogni nicchia lo amplia.
 *
 * Non sono consulenza legale. Finché `LEGAL_MODEL_REVIEWED` è falso le pagine sono segnate come
 * bozza (`data-legal-placeholder`) e `check-site` ferma la build dei siti veri: il testo va fatto
 * rivedere da un legale una volta per tutti i siti, poi si porta la costante a vero. Le parti che
 * dipendono da dati dell'attività che il sito non ha (registro delle imprese, autorizzazioni,
 * prezzi con o senza imposte) sono voci `todo`, da completare sito per sito.
 */

/** Data (AAAA-MM-GG) dell'ultima modifica del modello: sta in fondo alle pagine, non è la data di build. */
export const LEGAL_MODEL_VERSION = "2026-11-21";

/** Vero solo dopo la revisione di un legale; finché è falso le pagine sono una bozza e bloccano i siti veri. */
export const LEGAL_MODEL_REVIEWED = false;

/** Vero se le pagine legali sono ancora una bozza (modello non rivisto): allora segnano `data-legal-placeholder`. */
export function legalDraft(reviewed: boolean = LEGAL_MODEL_REVIEWED): boolean {
	return !reviewed;
}

type CookieTool = "turnstile" | "analytics" | "none";

export type LegalBlock =
	| { kind: "p"; text: string; cookieTool?: CookieTool }
	| { kind: "h3"; text: string }
	| { kind: "ul"; items: string[] }
	| { kind: "facts"; facts: LegalFact[] }
	| { kind: "link"; text: string; href: string }
	/** Dato del singolo sito che il modello non può conoscere: da completare, ferma la build dei siti veri. */
	| { kind: "todo"; text: string };

export interface LegalFact {
	label: string;
	value: string;
	href?: string;
}

export interface LegalSection {
	/** Ancora (per l'indice della pagina). */
	id: string;
	heading: string;
	blocks: LegalBlock[];
}

/** Funzioni del sito che i testi devono nominare. Senza, il testo non le cita. */
export interface LegalFeatures {
	/** Il sito ha un modulo (contatti o richiesta di prenotazione). */
	form: boolean;
	/** Il modulo è di prenotazione: chiede anche data, ora e numero di persone. */
	bookingForm?: boolean;
	/** Il sito mostra testimonianze con il nome di chi le ha scritte. */
	testimonials?: boolean;
	/** Il sito linka WhatsApp o profili social (servizi di terzi). */
	thirdParties?: boolean;
	/** Il sito linka una mappa (Google Maps). */
	mapLink?: boolean;
	/** Il sito mostra prezzi (per esempio un menu o un listino). */
	prices?: boolean;
	/** Indirizzi delle pagine legali, per i rimandi tra l'una e l'altra. */
	links?: Partial<Record<LegalSlug, string>>;
}

export function resolveLegalFeatures(
	config: Pick<SiteConfig, "modules">,
	features: LegalFeatures,
) {
	return {
		...features,
		antispam: antispamMode(config) === "turnstile",
		analytics: analyticsMode(config) === "cloudflare",
	};
}

function companyFacts(
	company: CompanyInfo,
	language: Language,
	includeContacts: boolean,
): LegalFact[] {
	const labels = LEGAL_LABELS[language];
	const { address } = company;
	const facts: LegalFact[] = [
		{ label: labels.facts.name, value: company.name },
		{
			label: labels.facts.legalType,
			value: labels.legalTypes[company.legalType],
		},
		{
			label: labels.facts.address,
			value: `${address.street}, ${address.postalCode} ${address.city} (${address.province})`,
		},
		{ label: labels.facts.vatNumber, value: company.vatNumber },
	];
	if (company.reaNumber) {
		facts.push({ label: labels.facts.reaNumber, value: company.reaNumber });
	}
	if (company.shareCapital) {
		facts.push({
			label: labels.facts.shareCapital,
			value: company.shareCapital,
		});
	}
	const email = includeContacts
		? companyEmailContact(company.email)
		: undefined;
	if (email) {
		facts.push({
			label: labels.facts.email,
			value: email.label,
			href: email.href,
		});
	}
	if (includeContacts && company.phone) {
		facts.push({ label: labels.facts.phone, value: company.phone });
	}
	return facts;
}

const p = (text: string, cookieTool?: CookieTool): LegalBlock => ({
	kind: "p",
	text,
	cookieTool,
});
const h3 = (text: string): LegalBlock => ({ kind: "h3", text });
const ul = (items: string[]): LegalBlock => ({ kind: "ul", items });
const todo = (text: string): LegalBlock => ({ kind: "todo", text });
/** Strumenti di terzi che potrebbero usare cookie o memoria del browser: finché non sono dichiarati, il testo «nessun cookie» non è vero. */
type ResolvedLegalFeatures = ReturnType<typeof resolveLegalFeatures>;

const usesThirdPartyStorage = (features: ResolvedLegalFeatures): boolean =>
	Boolean(features.antispam || features.analytics);

const link = (text: string, href: string | undefined): LegalBlock[] =>
	href ? [{ kind: "link", text, href }] : [];

/**
 * Cookie con strumenti di terzi: descrive cosa fanno e lascia una voce `todo` con l'inventario vero
 * (nome, durata, finalità), che si ricava dal browser sul sito reale: finché non c'è, il sito non esce.
 */
function thirdPartyCookieBlocks(
	features: ResolvedLegalFeatures,
	t: (it: string, en: string) => string,
): LegalBlock[] {
	const blocks: LegalBlock[] = [];
	if (features.antispam) {
		blocks.push(
			p(
				t(
					"Nel modulo è presente il widget Cloudflare Turnstile, progettato per contrastare gli invii automatici. Il widget può usare cookie o l'archiviazione locale del browser. Il servizio è fornito da Cloudflare, Inc.",
					"The form includes the Cloudflare Turnstile widget, designed to counter automated submissions. The widget may use cookies or browser local storage. The service is provided by Cloudflare, Inc.",
				),
				"turnstile",
			),
		);
	}
	if (features.analytics) {
		blocks.push(
			p(
				t(
					"Il sito misura le visite con Cloudflare Web Analytics, che produce statistiche aggregate sull'uso del sito.",
					"The site measures visits with Cloudflare Web Analytics, which produces aggregate statistics on site use.",
				),
				"analytics",
			),
		);
	}
	blocks.push(
		todo(
			t(
				"Elencare i cookie e gli altri strumenti realmente presenti (nome, durata, finalità, titolare), verificandoli nel browser sul sito pubblicato, e decidere con il legale se serve il consenso.",
				"List the cookies and other tools actually present (name, duration, purpose, owner), checking them in the browser on the published site, and decide with the lawyer whether consent is needed.",
			),
		),
	);
	return blocks;
}

/** Le sezioni di una pagina legale nella lingua, adattate ai dati dell'attività e alle funzioni attive. */
export function legalSections(
	slug: LegalSlug,
	language: Language,
	company: CompanyInfo,
	editorial: LegalFeatures = { form: false },
	config: Pick<SiteConfig, "modules"> = {},
): LegalSection[] {
	const features = resolveLegalFeatures(config, editorial);
	const t = (it: string, en: string) => (language === "it" ? it : en);
	const emailContact = companyEmailContact(company.email);
	const email = emailContact?.label;
	const updated = formatDay(LEGAL_MODEL_VERSION, language);
	const lastUpdate = p(
		t(
			`Ultimo aggiornamento del modello: ${updated}.`,
			`Model last updated: ${updated}.`,
		),
	);
	const services = [
		...(features.thirdParties
			? [
					t(
						"WhatsApp, Instagram, Facebook e TikTok",
						"WhatsApp, Instagram, Facebook and TikTok",
					),
				]
			: []),
		...(features.mapLink ? ["Google Maps"] : []),
	];

	switch (slug) {
		case "privacy":
			return privacy();
		case "cookie":
			return cookie();
		case "note-legali":
			return legalNotice();
		case "accessibilita":
			return accessibility();
	}

	function privacy(): LegalSection[] {
		const required = features.bookingForm
			? t(
					"nome, un recapito (email o telefono), data, ora e numero di persone",
					"name, a contact (email or phone), date, time and number of guests",
				)
			: t(
					"nome e un recapito (email o telefono)",
					"name and a contact (email or phone)",
				);
		return [
			{
				id: "titolare",
				heading: t("Titolare del trattamento", "Data controller"),
				blocks: [
					p(
						t(
							"Il titolare del trattamento dei dati personali (di seguito, «Titolare») è:",
							"The data controller of personal data (hereinafter, the “Controller”) is:",
						),
					),
					{ kind: "facts", facts: companyFacts(company, language, true) },
					email
						? p(
								t(
									`Per qualsiasi richiesta sul trattamento dei dati personali puoi scrivere al Titolare all'indirizzo ${email}.`,
									`For any request about the processing of personal data you can write to the Controller at ${email}.`,
								),
							)
						: todo(
								t(
									"Indicare un indirizzo email o PEC a cui gli interessati possano scrivere per esercitare i propri diritti.",
									"Provide an email or certified email address where data subjects can write to exercise their rights.",
								),
							),
				],
			},
			{
				id: "dati",
				heading: t("Tipologie di dati trattati", "Types of data processed"),
				blocks: [
					h3(t("Dati di navigazione", "Browsing data")),
					p(
						t(
							"I sistemi informatici che fanno funzionare il sito acquisiscono, durante il normale esercizio, alcuni dati personali la cui trasmissione è implicita nell'uso dei protocolli di comunicazione di Internet: indirizzo IP, data e ora della richiesta, indirizzo della pagina richiesta, metodo usato, dimensione e esito della risposta, tipo di browser e di sistema operativo. Sono usati solo per ricavare informazioni statistiche anonime sull'uso del sito, per controllarne il corretto funzionamento e per accertare responsabilità in caso di reati informatici ai danni del sito.",
							"The computer systems that run the website collect, during normal operation, some personal data whose transmission is implicit in the use of Internet communication protocols: IP address, date and time of the request, address of the requested page, method used, size and outcome of the response, type of browser and operating system. They are used only to obtain anonymous statistics on the use of the site, to check that it works correctly and to ascertain responsibility in the event of cybercrimes against the site.",
						),
					),
					h3(t("Dati forniti volontariamente", "Data you provide voluntarily")),
					features.form
						? p(
								features.bookingForm
									? t(
											"Se invii una richiesta tramite il modulo, il sito tratta i dati che inserisci: nome, email e/o telefono, data, ora e numero di persone richiesti, eventuali note. Non inserire dati non necessari, in particolare dati su salute, convinzioni religiose o altre categorie particolari di dati (per esempio, per le allergie scrivi solo ciò che serve a gestire la prenotazione).",
											"If you send a request through the form, the site processes the data you enter: name, email and/or phone, requested date, time and number of guests, any notes. Do not enter unnecessary data, in particular data about health, religious beliefs or other special categories of data (for example, for allergies write only what is needed to handle the booking).",
										)
									: t(
											"Se invii un messaggio tramite il modulo, il sito tratta i dati che inserisci: nome, email e/o telefono ed eventuale testo del messaggio. Non inserire dati non necessari, in particolare dati su salute, convinzioni religiose o altre categorie particolari di dati.",
											"If you send a message through the form, the site processes the data you enter: name, email and/or phone and any text of the message. Do not enter unnecessary data, in particular data about health, religious beliefs or other special categories of data.",
										),
							)
						: p(
								t(
									"Il sito non ha moduli e non raccoglie dati forniti direttamente dall'utente. Se scrivi o telefoni al Titolare ai recapiti indicati, i dati che comunichi sono usati solo per risponderti.",
									"The site has no forms and does not collect data provided directly by the user. If you write or call the Controller at the contacts shown, the data you share is used only to reply to you.",
								),
							),
					h3(t("Cookie", "Cookies")),
					...(usesThirdPartyStorage(features)
						? [
								p(
									t(
										"Il sito non usa cookie di profilazione. Alcune funzioni usano servizi di terzi, elencati nell'informativa sui cookie.",
										"The site does not use profiling cookies. Some features use third-party services, listed in the cookie notice.",
									),
								),
							]
						: [
								p(
									t(
										"Il sito non usa cookie né altri strumenti di tracciamento.",
										"The site uses no cookies or other tracking tools.",
									),
								),
							]),
					...link(
						t("Leggi l'informativa sui cookie", "Read the cookie notice"),
						features.links?.cookie,
					),
				],
			},
			{
				id: "finalita",
				heading: t(
					"Finalità e basi giuridiche del trattamento",
					"Purposes and legal bases",
				),
				blocks: [
					ul([
						t(
							"Far funzionare il sito, garantirne la sicurezza e ricavare statistiche anonime sull'uso. Base giuridica: legittimo interesse del Titolare (art. 6, par. 1, lett. f, GDPR).",
							"Running the site, keeping it secure and obtaining anonymous usage statistics. Legal basis: the Controller's legitimate interest (Art. 6(1)(f) GDPR).",
						),
						...(features.form
							? [
									features.bookingForm
										? t(
												"Rispondere alle richieste inviate tramite il modulo e gestire le richieste di prenotazione. Base giuridica: esecuzione di misure precontrattuali adottate su richiesta dell'interessato (art. 6, par. 1, lett. b, GDPR).",
												"Replying to requests sent through the form and handling booking requests. Legal basis: taking steps at the request of the data subject prior to entering into a contract (Art. 6(1)(b) GDPR).",
											)
										: t(
												"Rispondere ai messaggi inviati tramite il modulo. Base giuridica: esecuzione di misure precontrattuali adottate su richiesta dell'interessato (art. 6, par. 1, lett. b, GDPR) o, se il messaggio non riguarda un possibile contratto, legittimo interesse a rispondere (lett. f).",
												"Replying to messages sent through the form. Legal basis: taking steps at the request of the data subject prior to entering into a contract (Art. 6(1)(b) GDPR) or, if the message does not concern a possible contract, the legitimate interest in replying (point (f)).",
											),
								]
							: []),
						...(features.testimonials
							? [
									t(
										"Pubblicare sul sito le testimonianze dei clienti, con il nome indicato dall'interessato. Base giuridica: consenso (art. 6, par. 1, lett. a, GDPR), che puoi revocare in qualsiasi momento.",
										"Publishing customer testimonials on the site, with the name chosen by the data subject. Legal basis: consent (Art. 6(1)(a) GDPR), which you can withdraw at any time.",
									),
								]
							: []),
						t(
							"Adempiere a obblighi di legge. Base giuridica: art. 6, par. 1, lett. c, GDPR.",
							"Complying with legal obligations. Legal basis: Art. 6(1)(c) GDPR.",
						),
						t(
							"Accertare, esercitare o difendere un diritto in sede giudiziaria. Base giuridica: legittimo interesse del Titolare (art. 6, par. 1, lett. f, GDPR).",
							"Establishing, exercising or defending legal claims. Legal basis: the Controller's legitimate interest (Art. 6(1)(f) GDPR).",
						),
					]),
				],
			},
			{
				id: "conferimento",
				heading: t(
					"Natura del conferimento dei dati",
					"Whether providing data is mandatory",
				),
				blocks: [
					p(
						t(
							"I dati di navigazione sono necessari al funzionamento del sito. Per usare il sito non devi fornire nessun altro dato.",
							"Browsing data is necessary for the site to work. You do not have to provide any other data to use the site.",
						),
					),
					...(features.form
						? [
								p(
									t(
										`Nel modulo sono obbligatori: ${required}. Senza questi dati non possiamo rispondere alla richiesta. Gli altri campi sono facoltativi. La casella «Ho letto l'informativa sulla privacy» conferma la presa visione di questo testo: non è un consenso al trattamento, che avviene sulla base indicata sopra.`,
										`The following are mandatory in the form: ${required}. Without them we cannot reply to the request. The other fields are optional. The “I have read the privacy notice” box confirms that you have read this text: it is not consent to processing, which takes place on the basis stated above.`,
									),
								),
							]
						: []),
				],
			},
			{
				id: "modalita",
				heading: t(
					"Modalità del trattamento e sicurezza",
					"How data is processed and kept secure",
				),
				blocks: [
					p(
						t(
							"I dati sono trattati con strumenti informatici e telematici, con misure tecniche e organizzative adeguate a garantire un livello di sicurezza adeguato al rischio (art. 32 GDPR). Non è svolto alcun processo decisionale automatizzato né profilazione.",
							"Data is processed with computer and telematic tools, with technical and organisational measures appropriate to the risk (Art. 32 GDPR). No automated decision-making or profiling is carried out.",
						),
					),
					...(features.form
						? [
								p(
									t(
										"I messaggi inviati tramite il modulo sono trasmessi al Titolare per posta elettronica; il sito non li conserva.",
										"Messages sent through the form are forwarded to the Controller by email; the site does not store them.",
									),
								),
							]
						: []),
				],
			},
			{
				id: "destinatari",
				heading: t("Destinatari dei dati", "Recipients of data"),
				blocks: [
					p(
						t(
							"I dati possono essere comunicati a:",
							"Data may be disclosed to:",
						),
					),
					ul([
						t(
							"personale autorizzato dal Titolare, vincolato alla riservatezza;",
							"personnel authorised by the Controller and bound by confidentiality;",
						),
						t(
							"fornitori di servizi tecnici (hosting e infrastruttura del sito, posta elettronica), che agiscono come responsabili del trattamento ai sensi dell'art. 28 GDPR;",
							"technical service providers (site hosting and infrastructure, email), acting as processors under Art. 28 GDPR;",
						),
						t(
							"consulenti professionali e autorità pubbliche, quando la legge lo richiede.",
							"professional advisers and public authorities, where required by law.",
						),
					]),
					p(t("I dati non sono diffusi.", "Data is not disseminated.")),
				],
			},
			{
				id: "trasferimenti",
				heading: t(
					"Trasferimento dei dati fuori dallo Spazio economico europeo",
					"Transfers outside the European Economic Area",
				),
				blocks: [
					p(
						t(
							"Alcuni fornitori di servizi tecnici possono trattare dati in paesi al di fuori dello Spazio economico europeo. In tal caso il trasferimento avviene solo con le garanzie previste dal Capo V del GDPR, come una decisione di adeguatezza della Commissione europea o le clausole contrattuali tipo.",
							"Some technical service providers may process data in countries outside the European Economic Area. In that case the transfer takes place only with the safeguards provided for in Chapter V GDPR, such as a European Commission adequacy decision or standard contractual clauses.",
						),
					),
				],
			},
			{
				id: "conservazione",
				heading: t("Periodo di conservazione", "Retention"),
				blocks: [
					p(
						t(
							"I dati sono conservati per il tempo strettamente necessario alle finalità per cui sono trattati e, dopo, per il tempo previsto da obblighi di legge o necessario a tutelare i diritti del Titolare in sede giudiziaria. I dati di navigazione sono conservati per il solo tempo tecnico necessario.",
							"Data is kept for the time strictly necessary for the purposes for which it is processed and, afterwards, for the time required by legal obligations or necessary to protect the Controller's rights in court. Browsing data is kept only for the technically necessary time.",
						),
					),
					...(features.testimonials
						? [
								p(
									t(
										"Le testimonianze restano pubblicate finché non revochi il consenso o chiedi di rimuoverle.",
										"Testimonials remain published until you withdraw consent or ask for them to be removed.",
									),
								),
							]
						: []),
				],
			},
			...(features.thirdParties || features.mapLink || features.testimonials
				? [
						{
							id: "terzi",
							heading: t(
								"Collegamenti a servizi di terzi e testimonianze",
								"Links to third-party services and testimonials",
							),
							blocks: [
								...(services.length > 0
									? [
											p(
												t(
													`Il sito contiene collegamenti a servizi di terzi (${services.join("; ")}). Sono semplici collegamenti: il sito non incorpora pulsanti, widget o contenuti di terzi e non trasmette loro dati dell'utente. Cliccando su un collegamento lasci il sito e si applicano le informative sulla privacy dei rispettivi titolari.`,
													`The site contains links to third-party services (${services.join("; ")}). They are simple links: the site does not embed third-party buttons, widgets or content and does not send them any user data. By clicking a link you leave the site and the privacy notices of the respective controllers apply.`,
												),
											),
										]
									: []),
								...(features.testimonials
									? [
											p(
												t(
													"Le testimonianze sono inserite dal Titolare con il consenso di chi le ha rilasciate e riportano il nome nella forma scelta dall'interessato, anche solo con le iniziali. Chi desidera modificare o rimuovere la propria testimonianza può scrivere al Titolare.",
													"Testimonials are entered by the Controller with the consent of the people who gave them and show the name in the form chosen by the data subject, even just initials. Anyone who wishes to change or remove their testimonial can write to the Controller.",
												),
											),
										]
									: []),
							],
						},
					]
				: []),
			{
				id: "diritti",
				heading: t("Diritti dell'interessato", "Your rights"),
				blocks: [
					p(
						t(
							"In ogni momento puoi esercitare nei confronti del Titolare i diritti previsti dagli artt. 15-22 GDPR:",
							"At any time you can exercise against the Controller the rights provided for in Arts. 15-22 GDPR:",
						),
					),
					ul([
						t(
							"accesso ai tuoi dati personali (art. 15);",
							"access to your personal data (Art. 15);",
						),
						t(
							"rettifica dei dati inesatti (art. 16);",
							"rectification of inaccurate data (Art. 16);",
						),
						t(
							"cancellazione dei dati (art. 17);",
							"erasure of data (Art. 17);",
						),
						t(
							"limitazione del trattamento (art. 18);",
							"restriction of processing (Art. 18);",
						),
						t("portabilità dei dati (art. 20);", "data portability (Art. 20);"),
						t(
							"opposizione al trattamento fondato sul legittimo interesse (art. 21);",
							"objection to processing based on legitimate interest (Art. 21);",
						),
						t(
							"revoca del consenso, ove il trattamento si basi su di esso, senza pregiudicare la liceità del trattamento precedente (art. 7, par. 3).",
							"withdrawal of consent, where processing is based on it, without affecting the lawfulness of earlier processing (Art. 7(3)).",
						),
					]),
					p(
						t(
							email
								? `Per esercitarli scrivi a ${email}. Il Titolare risponde senza ingiustificato ritardo e comunque entro un mese dalla richiesta, termine prorogabile di due mesi nei casi previsti dall'art. 12 GDPR.`
								: "Per esercitarli scrivi al Titolare ai recapiti indicati. Il Titolare risponde senza ingiustificato ritardo e comunque entro un mese dalla richiesta, termine prorogabile di due mesi nei casi previsti dall'art. 12 GDPR.",
							email
								? `To exercise them write to ${email}. The Controller replies without undue delay and in any case within one month of the request, a period that can be extended by two months in the cases provided for in Art. 12 GDPR.`
								: "To exercise them write to the Controller at the contacts shown. The Controller replies without undue delay and in any case within one month of the request, a period that can be extended by two months in the cases provided for in Art. 12 GDPR.",
						),
					),
					p(
						t(
							"Se ritieni che il trattamento violi il GDPR hai il diritto di proporre reclamo al Garante per la protezione dei dati personali (garanteprivacy.it) o all'autorità di controllo dello Stato membro in cui risiedi o lavori, o in cui si è verificata la presunta violazione (art. 77 GDPR).",
							"If you believe the processing breaches the GDPR you have the right to lodge a complaint with the Italian data protection authority (Garante per la protezione dei dati personali, garanteprivacy.it) or with the supervisory authority of the Member State where you live or work, or where the alleged infringement took place (Art. 77 GDPR).",
						),
					),
				],
			},
			{
				id: "minori",
				heading: t("Minori", "Children"),
				blocks: [
					p(
						t(
							"Il sito non è destinato ai minori e non raccoglie consapevolmente dati di minori di 14 anni.",
							"The site is not intended for children and does not knowingly collect data from children under 14.",
						),
					),
				],
			},
			{
				id: "modifiche",
				heading: t("Modifiche a questa informativa", "Changes to this notice"),
				blocks: [
					p(
						t(
							"Il Titolare può aggiornare questa informativa, anche per adeguarla a modifiche della legge o del sito. La versione in vigore è sempre quella pubblicata in questa pagina.",
							"The Controller may update this notice, including to reflect changes in the law or the site. The version in force is always the one published on this page.",
						),
					),
					lastUpdate,
				],
			},
		];
	}

	function cookie(): LegalSection[] {
		return [
			{
				id: "cosa-sono",
				heading: t("Cosa sono i cookie", "What cookies are"),
				blocks: [
					p(
						t(
							"I cookie sono piccoli file di testo che i siti salvano nel dispositivo dell'utente. Le stesse finalità possono essere raggiunte con strumenti simili, come l'archiviazione locale del browser (localStorage e sessionStorage), il fingerprinting o i pixel di tracciamento. In questa pagina «cookie» indica tutti questi strumenti.",
							"Cookies are small text files that websites save on the user's device. The same purposes can be achieved with similar tools, such as the browser's local storage (localStorage and sessionStorage), fingerprinting or tracking pixels. On this page “cookies” means all of these tools.",
						),
					),
					p(
						t(
							"Si distinguono in cookie tecnici, necessari al funzionamento del sito o a fornire un servizio richiesto dall'utente, e cookie di profilazione o di terze parti, usati per analisi, pubblicità o monitoraggio del comportamento.",
							"They are divided into technical cookies, necessary for the site to work or to provide a service requested by the user, and profiling or third-party cookies, used for analytics, advertising or monitoring behaviour.",
						),
					),
				],
			},
			{
				id: "utilizzati",
				heading: t(
					"Cookie utilizzati da questo sito",
					"Cookies used by this site",
				),
				blocks: [
					...(usesThirdPartyStorage(features)
						? thirdPartyCookieBlocks(features, t)
						: [
								p(
									t(
										"Questo sito non utilizza cookie.",
										"This site does not use cookies.",
									),
									"none",
								),
								p(
									t(
										"Non usa nemmeno altri strumenti di memorizzazione o di accesso alle informazioni presenti nel dispositivo (come localStorage o sessionStorage), né strumenti di profilazione o di tracciamento. I caratteri e le immagini sono serviti dal sito stesso. Per questo non compare nessun banner dei cookie e non serve il tuo consenso.",
										"It does not use any other tools to store or access information on your device (such as localStorage or sessionStorage), nor profiling or tracking tools. Fonts and images are served by the site itself. For this reason no cookie banner appears and your consent is not needed.",
									),
								),
							]),
				],
			},
			{
				id: "consenso",
				heading: t(
					"Cookie tecnici e consenso",
					"Technical cookies and consent",
				),
				blocks: [
					p(
						t(
							"Secondo l'art. 122 del Codice in materia di protezione dei dati personali (D.Lgs. 196/2003) e le Linee guida del Garante sui cookie e altri strumenti di tracciamento, i cookie tecnici si possono usare senza il consenso dell'utente, mentre per gli altri serve un consenso preventivo. Se in futuro il sito userà strumenti che richiedono il consenso, questa pagina sarà aggiornata prima di attivarli.",
							"Under Article 122 of the Italian Personal Data Protection Code (Legislative Decree 196/2003) and the Italian data protection authority's guidelines on cookies and other tracking tools, technical cookies may be used without the user's consent, while any others require prior consent. If in the future the site uses tools that require consent, this page will be updated before they are activated.",
						),
					),
				],
			},
			...(services.length > 0
				? [
						{
							id: "terzi",
							heading: t(
								"Collegamenti a siti di terzi",
								"Links to third-party sites",
							),
							blocks: [
								p(
									t(
										`Il sito contiene collegamenti a servizi di terzi (${services.join("; ")}). Sono semplici collegamenti e il sito non incorpora contenuti di terzi. Se li apri lasci il sito: quei servizi possono usare propri cookie, su cui il Titolare non ha controllo. Consulta le loro informative.`,
										`The site contains links to third-party services (${services.join("; ")}). They are simple links and the site does not embed third-party content. If you open them you leave the site: those services may use their own cookies, over which the Controller has no control. Please read their notices.`,
									),
								),
							],
						},
					]
				: []),
			{
				id: "gestione",
				heading: t(
					"Come gestire i cookie nel browser",
					"How to manage cookies in your browser",
				),
				blocks: [
					p(
						t(
							"Puoi in ogni momento bloccare o cancellare i cookie dalle impostazioni del tuo browser (per esempio Chrome, Firefox, Safari, Edge): la guida del browser spiega come. Questo vale anche per i siti di terzi che apri dai collegamenti.",
							"You can block or delete cookies at any time from your browser settings (for example Chrome, Firefox, Safari, Edge): the browser's help explains how. This also applies to the third-party sites you open from links.",
						),
					),
				],
			},
			{
				id: "approfondimenti",
				heading: t("Altre informazioni", "More information"),
				blocks: [
					p(
						t(
							"Per sapere come sono trattati i tuoi dati personali leggi l'informativa sulla privacy.",
							"To find out how your personal data is processed, read the privacy notice.",
						),
					),
					...link(
						t("Informativa sulla privacy", "Privacy notice"),
						features.links?.privacy,
					),
					lastUpdate,
				],
			},
		];
	}

	function legalNotice(): LegalSection[] {
		const owner = company.legalType;
		return [
			{
				id: "titolare",
				heading: t(
					"Titolare del sito e dati identificativi",
					"Site owner and identification details",
				),
				blocks: [
					p(
						t(
							"Informazioni generali ai sensi dell'art. 7 del D.Lgs. 70/2003. Il sito è gestito da:",
							"General information under Article 7 of Italian Legislative Decree 70/2003. The site is operated by:",
						),
					),
					{ kind: "facts", facts: companyFacts(company, language, true) },
					...(emailContact
						? []
						: [
								todo(
									t(
										"Indicare un indirizzo di posta elettronica (o PEC) per contattare rapidamente il titolare del sito.",
										"Provide an email (or certified email) address to contact the site owner quickly.",
									),
								),
							]),
					...(owner === "professionista"
						? [
								todo(
									t(
										"Indicare l'ordine o collegio professionale di appartenenza, il titolo professionale e il numero di iscrizione, ove previsti.",
										"Indicate the professional body, professional title and registration number, where required.",
									),
								),
							]
						: company.reaNumber
							? []
							: [
									todo(
										t(
											"Indicare il numero di iscrizione al registro delle imprese (REA o CCIAA), ove previsto.",
											"Indicate the business register registration number (REA or CCIAA), where required.",
										),
									),
								]),
					todo(
						t(
							"Indicare gli estremi di eventuali autorizzazioni o segnalazioni certificate (per esempio SCIA) richieste dall'attività.",
							"Indicate the details of any authorisations or certified notifications required for the business.",
						),
					),
					...(features.prices
						? [
								todo(
									t(
										"Indicare se i prezzi mostrati nel sito sono comprensivi di imposte e di eventuali spese.",
										"State whether the prices shown on the site include taxes and any charges.",
									),
								),
							]
						: []),
				],
			},
			{
				id: "utilizzo",
				heading: t(
					"Condizioni di utilizzo del sito",
					"Terms of use of the site",
				),
				blocks: [
					p(
						t(
							"Le informazioni pubblicate nel sito hanno scopo informativo. Il Titolare si impegna a mantenerle corrette e aggiornate, ma non può garantire l'assenza di errori o omissioni. Orari, prezzi, disponibilità e altri dati possono cambiare senza preavviso: ti invitiamo a verificarli direttamente con l'attività. Usando il sito accetti queste condizioni.",
							"The information published on the site is for information purposes. The Controller undertakes to keep it correct and up to date, but cannot guarantee the absence of errors or omissions. Opening hours, prices, availability and other data may change without notice: please check them directly with the business. By using the site you accept these terms.",
						),
					),
				],
			},
			{
				id: "proprieta",
				heading: t("Proprietà intellettuale", "Intellectual property"),
				blocks: [
					p(
						t(
							"Testi, immagini, loghi, marchi, grafica e ogni altro contenuto del sito sono protetti dalla normativa sul diritto d'autore (legge 633/1941) e sulla proprietà industriale e appartengono al Titolare o ai rispettivi titolari. Non possono essere copiati, riprodotti, modificati o diffusi senza autorizzazione scritta, salvo i casi consentiti dalla legge.",
							"Texts, images, logos, trademarks, graphics and all other content of the site are protected by copyright law (Italian Law 633/1941) and industrial property law and belong to the Controller or to their respective owners. They may not be copied, reproduced, modified or distributed without written permission, except where permitted by law.",
						),
					),
				],
			},
			{
				id: "link",
				heading: t(
					"Collegamenti a siti di terzi",
					"Links to third-party sites",
				),
				blocks: [
					p(
						t(
							"Il sito può contenere collegamenti a siti di terzi. Il Titolare non controlla questi siti e non è responsabile dei loro contenuti, della loro disponibilità o delle loro politiche sulla privacy.",
							"The site may contain links to third-party sites. The Controller does not control these sites and is not responsible for their content, availability or privacy policies.",
						),
					),
				],
			},
			{
				id: "responsabilita",
				heading: t("Limitazione di responsabilità", "Limitation of liability"),
				blocks: [
					p(
						t(
							"Il sito è fornito «così com'è». Nei limiti consentiti dalla legge, il Titolare non risponde di interruzioni o malfunzionamenti del sito né dei danni derivanti dall'uso delle informazioni in esso contenute, salvo dolo o colpa grave. Restano ferme le norme di legge che non si possono derogare, in particolare a tutela dei consumatori.",
							"The site is provided “as is”. To the extent permitted by law, the Controller is not liable for interruptions or malfunctions of the site or for damage arising from the use of the information it contains, except in cases of wilful misconduct or gross negligence. Mandatory legal provisions, in particular those protecting consumers, remain unaffected.",
						),
					),
				],
			},
			{
				id: "legge",
				heading: t(
					"Legge applicabile e foro competente",
					"Governing law and jurisdiction",
				),
				blocks: [
					p(
						t(
							"Queste note sono regolate dalla legge italiana. Per ogni controversia è competente il foro del Titolare, salvo che l'utente sia un consumatore: in tal caso resta competente il foro del luogo di residenza o di domicilio del consumatore (art. 66-bis del Codice del consumo).",
							"These notes are governed by Italian law. Any dispute falls within the jurisdiction of the courts of the Controller's place of business, unless the user is a consumer: in that case the courts of the consumer's place of residence or domicile remain competent (Article 66-bis of the Italian Consumer Code).",
						),
					),
				],
			},
			{
				id: "contatti",
				heading: t(
					"Contatti e documenti collegati",
					"Contacts and related documents",
				),
				blocks: [
					p(
						email
							? t(
									`Per segnalazioni o richieste relative al sito scrivi a ${email}.`,
									`For reports or requests about the site write to ${email}.`,
								)
							: t(
									"Per segnalazioni o richieste relative al sito usa i recapiti indicati sopra.",
									"For reports or requests about the site use the contacts shown above.",
								),
					),
					...link(
						t("Informativa sulla privacy", "Privacy notice"),
						features.links?.privacy,
					),
					...link(
						t("Informativa sui cookie", "Cookie notice"),
						features.links?.cookie,
					),
					lastUpdate,
				],
			},
		];
	}

	function accessibility(): LegalSection[] {
		return [
			{
				id: "impegno",
				heading: t("Il nostro impegno", "Our commitment"),
				blocks: [
					p(
						t(
							"Vogliamo che chiunque possa usare questo sito, comprese le persone con disabilità, e lo progettiamo per rispettare le Linee guida per l'accessibilità dei contenuti web (WCAG) 2.2 al livello AA, richiamate dalla norma europea EN 301 549.",
							"We want everyone to be able to use this site, including people with disabilities, and we design it to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, referenced by the European standard EN 301 549.",
						),
					),
				],
			},
			{
				id: "stato",
				heading: t("Stato di conformità", "Conformance status"),
				blocks: [
					p(
						t(
							"A ogni pubblicazione il sito è verificato con controlli automatici (axe-core) su tutte le pagine, in una larghezza da telefono e in una da computer, con e senza JavaScript, compresi il contrasto dei colori, lo scorrimento orizzontale e il rispetto della preferenza «riduci animazioni» del sistema.",
							"On every release the site is checked with automated tests (axe-core) on all pages, at a phone width and a desktop width, with and without JavaScript, including colour contrast, horizontal scrolling and respect for the system's “reduce motion” preference.",
						),
					),
					p(
						t(
							"I controlli automatici non individuano tutti i problemi e non sostituiscono una valutazione manuale con tecnologie assistive. Non possiamo quindi escludere che alcune parti non siano pienamente accessibili.",
							"Automated checks do not find every problem and do not replace a manual evaluation with assistive technologies. We therefore cannot rule out that some parts are not fully accessible.",
						),
					),
				],
			},
			{
				id: "caratteristiche",
				heading: t("Cosa abbiamo fatto", "What we have done"),
				blocks: [
					ul([
						t(
							"Struttura delle pagine con titoli in ordine e punti di riferimento (intestazione, contenuto principale, piè di pagina) e un link «Vai al contenuto».",
							"Page structure with headings in order and landmarks (header, main content, footer) and a “Skip to content” link.",
						),
						t(
							"Tutte le funzioni si usano anche con la sola tastiera, con il focus sempre visibile.",
							"All functions can also be used with the keyboard alone, with the focus always visible.",
						),
						t(
							"Colori con contrasto sufficiente e testo ridimensionabile.",
							"Colours with sufficient contrast and resizable text.",
						),
						t(
							"Testi alternativi per le immagini che portano informazione.",
							"Text alternatives for images that carry information.",
						),
						t(
							"I moduli hanno etichette collegate ai campi e usano i controlli nativi del browser.",
							"Forms have labels linked to their fields and use the browser's native controls.",
						),
						t(
							"Il contenuto è leggibile anche senza JavaScript e le animazioni si riducono o si fermano se il sistema lo chiede.",
							"The content is readable without JavaScript, and animations are reduced or stopped if the system asks.",
						),
					]),
				],
			},
			{
				id: "limiti",
				heading: t("Limiti noti", "Known limitations"),
				blocks: [
					p(
						t(
							"La qualità dei testi alternativi delle foto e dei testi dei contenuti dipende da chi li inserisce. I siti di terzi raggiungibili dai collegamenti (mappe, WhatsApp, social) hanno una loro accessibilità, su cui non abbiamo controllo.",
							"The quality of the text alternatives for photos and of the content depends on whoever enters it. Third-party sites reached through links (maps, WhatsApp, social media) have their own accessibility, over which we have no control.",
						),
					),
				],
			},
			{
				id: "segnalazioni",
				heading: t("Segnalare un problema", "Report a problem"),
				blocks: [
					p(
						email
							? t(
									"Se trovi una parte del sito che non riesci a usare o a leggere, scrivici: indica la pagina, il problema e, se vuoi, il browser o la tecnologia assistiva che usi. Ti risponderemo e, quando possibile, correggeremo il problema o ti daremo un'alternativa.",
									"If you find a part of the site you cannot use or read, write to us: tell us the page, the problem and, if you wish, the browser or assistive technology you use. We will reply and, where possible, fix the problem or offer you an alternative.",
								)
							: t(
									"Il canale di segnalazione sarà indicato qui quando l'attività avrà un indirizzo email.",
									"The reporting channel will be shown here once the business has an email address.",
								),
					),
					...(emailContact
						? [
								{
									kind: "facts" as const,
									facts: [
										{
											label: LEGAL_LABELS[language].facts.email,
											value: emailContact.label,
											href: emailContact.href,
										},
									],
								},
							]
						: []),
				],
			},
			{
				id: "reclami",
				heading: t(
					"Se la risposta non ti soddisfa",
					"If you are not satisfied with the reply",
				),
				blocks: [
					p(
						t(
							"Se ritieni che la nostra risposta non risolva il problema, ove applicabile ai sensi della Direttiva (UE) 2019/882 sui requisiti di accessibilità dei prodotti e dei servizi (European Accessibility Act) e della normativa nazionale che la recepisce, puoi rivolgerti all'autorità competente per la vigilanza.",
							"If you believe our reply does not solve the problem, where applicable under Directive (EU) 2019/882 on the accessibility requirements for products and services (European Accessibility Act) and the national law implementing it, you can contact the competent enforcement authority.",
						),
					),
					lastUpdate,
				],
			},
		];
	}
}
