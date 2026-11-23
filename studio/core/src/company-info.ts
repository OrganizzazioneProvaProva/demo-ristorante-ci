import { isValidVatNumber, parseCompanyEmails } from "@siti/config";
import { defineField, defineType } from "sanity";

/** Tipi di soggetto di 02, "Dati obbligatori del sito". */
export const LEGAL_TYPES = [
	{ title: "Ditta individuale", value: "ditta-individuale" },
	{ title: "Società di persone", value: "societa-di-persone" },
	{ title: "Società di capitali", value: "societa-di-capitali" },
	{ title: "Professionista", value: "professionista" },
] as const;

/**
 * Dati aziendali. Sono campi semplici, NON per lingua: partita IVA, sede e telefono sono
 * uguali in ogni lingua (si traducono solo le etichette, nel codice). Sono obbligatori
 * perché la partita IVA e i dati dell'attività vanno in homepage e nel footer (02).
 * Niente dati personali di visitatori: in Sanity i dataset del piano Free sono pubblici.
 *
 * Da validare con l'avvocato (06): quali dati servono per ogni tipo di soggetto. Qui
 * REA e capitale sociale sono obbligatori solo per le società di capitali.
 */
export const companyInfoType = defineType({
	name: "companyInfo",
	title: "Dati aziendali",
	type: "document",
	fields: [
		defineField({
			name: "name",
			title: "Nome dell'attività",
			type: "string",
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: "legalType",
			title: "Tipo di soggetto",
			type: "string",
			options: { list: [...LEGAL_TYPES], layout: "radio" },
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: "vatNumber",
			title: "Partita IVA",
			type: "string",
			description:
				"11 cifre, senza prefisso IT. Si controlla anche la cifra di controllo.",
			validation: (rule) =>
				rule.required().custom((value) => {
					if (value === undefined) return true;
					return isValidVatNumber(value)
						? true
						: "Partita IVA non valida: servono 11 cifre, senza IT, con cifra di controllo corretta.";
				}),
		}),
		defineField({
			name: "address",
			title: "Sede",
			type: "object",
			fields: [
				defineField({
					name: "street",
					title: "Via e numero civico",
					type: "string",
					validation: (rule) => rule.required(),
				}),
				defineField({
					name: "postalCode",
					title: "CAP",
					type: "string",
					validation: (rule) =>
						rule.required().regex(/^\d{5}$/, { name: "CAP a 5 cifre" }),
				}),
				defineField({
					name: "city",
					title: "Comune",
					type: "string",
					validation: (rule) => rule.required(),
				}),
				defineField({
					name: "province",
					title: "Provincia (sigla)",
					type: "string",
					validation: (rule) =>
						rule.required().regex(/^[A-Z]{2}$/, { name: "sigla in maiuscolo" }),
				}),
			],
			validation: (rule) => rule.required(),
		}),
		defineField({ name: "phone", title: "Telefono", type: "string" }),
		defineField({
			name: "email",
			title: "Email pubblica",
			type: "string",
			description: "Fino a tre indirizzi distinti, separati da virgola.",
			validation: (rule) =>
				rule.custom((value) =>
					value === undefined || parseCompanyEmails(value)
						? true
						: "Servono da uno a tre indirizzi email distinti, separati da virgola.",
				),
		}),
		defineField({
			name: "logo",
			title: "Logo (facoltativo)",
			type: "siteImage",
			description:
				"Compare grande nel piè di pagina. Formati: JPEG, PNG, WebP, AVIF (non SVG). Carica una versione grande, almeno il doppio di quella mostrata. Senza logo compare il nome dell'attività.",
		}),
		defineField({
			name: "reaNumber",
			title: "Numero REA",
			type: "string",
			hidden: ({ document }) => document?.legalType !== "societa-di-capitali",
			validation: (rule) =>
				rule.custom((value, context) =>
					context.document?.legalType === "societa-di-capitali" && !value
						? "Obbligatorio per le società di capitali"
						: true,
				),
		}),
		defineField({
			name: "shareCapital",
			title: "Capitale sociale",
			type: "string",
			hidden: ({ document }) => document?.legalType !== "societa-di-capitali",
			validation: (rule) =>
				rule.custom((value, context) =>
					context.document?.legalType === "societa-di-capitali" && !value
						? "Obbligatorio per le società di capitali"
						: true,
				),
		}),
	],
});
