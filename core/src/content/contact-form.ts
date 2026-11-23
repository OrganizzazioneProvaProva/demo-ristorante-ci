import {
	antispamMode,
	type Language,
	parseFormEndpoint,
	type SiteConfig,
} from "@siti/config";
import { z } from "zod";
import { isSiteLink } from "./links.ts";
import { pagePath } from "./pages.ts";
import { isReservedHost } from "./security.ts";

/**
 * Modulo di richiesta (02, "Azioni del sito"): l'elenco dei campi si scrive UNA volta. Da
 * quell'elenco derivano il form HTML (`ContactForm.astro`) e lo schema zod che userà il Worker
 * (passo 7). Il core ha i campi comuni; il preset di una nicchia li estende (per esempio data,
 * ora e persone per un ristorante).
 *
 * Il Worker, le notifiche e gli antispam non sono ancora collegati: il form punta a un
 * indirizzo segnaposto (`PLACEHOLDER_FORM_ENDPOINT`), ammesso solo nei siti `kind: "demo"`.
 */

export type FieldKind =
	| "text"
	| "email"
	| "tel"
	| "date"
	| "time"
	| "number"
	| "textarea";

export interface FormField {
	/** Nome del campo HTML e della chiave dello schema: `^[a-z][a-zA-Z0-9]*$`. */
	name: string;
	kind: FieldKind;
	required: boolean;
	label: Record<Language, string>;
	hint?: Record<Language, string>;
	autocomplete?: string;
	/** Per `number`: valore minimo e massimo. */
	min?: number;
	max?: number;
	/** Per `text` e `textarea`: lunghezza massima (predefinita 2000, 200 per `text`). */
	maxLength?: number;
}

/**
 * Indirizzo finto (il TLD `.invalid` è riservato e non si risolve mai): il form è completo ma
 * non spedisce nulla finché non c'è il Worker. In un sito vero la build si ferma (`check-site`).
 */
export const PLACEHOLDER_FORM_ENDPOINT = "https://form.invalid/richiesta";

export function isPlaceholderEndpoint(endpoint: string): boolean {
	return isReservedHost(endpoint);
}

/**
 * Destinazione e antispam del modulo, da `site.config.ts` (`modules.forms`, `modules.antispam`).
 * Senza endpoint scritto resta l'indirizzo segnaposto (ammesso solo nei siti `demo`, lo verifica
 * `check-site`). La chiave di Turnstile esce solo se l'antispam è `turnstile`.
 */
export function formSettings(config: Pick<SiteConfig, "modules">): {
	endpoint: string;
	turnstileSiteKey?: string;
} {
	const endpoint = requireFormEndpoint(
		config.modules?.forms?.endpoint ?? PLACEHOLDER_FORM_ENDPOINT,
	);
	return {
		endpoint,
		turnstileSiteKey:
			antispamMode(config) === "turnstile"
				? config.modules?.forms?.turnstileSiteKey
				: undefined,
	};
}

/** Campi comuni a ogni nicchia: nome, email e telefono (almeno uno), messaggio. */
export const BASE_REQUEST_FIELDS: readonly FormField[] = [
	{
		name: "name",
		kind: "text",
		required: true,
		label: { it: "Nome e cognome", en: "Full name" },
		autocomplete: "name",
	},
	{
		name: "email",
		kind: "email",
		required: false,
		label: { it: "Email", en: "Email" },
		hint: {
			it: "Indica almeno l'email o il telefono.",
			en: "Give at least an email or a phone number.",
		},
		autocomplete: "email",
	},
	{
		name: "phone",
		kind: "tel",
		required: false,
		label: { it: "Telefono", en: "Phone" },
		autocomplete: "tel",
	},
	{
		name: "message",
		kind: "textarea",
		required: false,
		label: { it: "Messaggio", en: "Message" },
	},
];

export interface FormLabels {
	submit: string;
	required: string;
	optional: string;
	consent: string;
	privacyLink: string;
	formLabel: string;
	/** Etichetta del campo trappola: la leggono solo i bot (il campo è nascosto alle persone). */
	honeypot: string;
	/** Dentro `<noscript>`: la verifica antispam non parte senza JavaScript. */
	antispamNoScript: string;
}

export const FORM_LABELS: Record<Language, FormLabels> = {
	it: {
		submit: "Invia la richiesta",
		required: "obbligatorio",
		optional: "facoltativo",
		consent: "Ho letto l'informativa sulla privacy",
		privacyLink: "Informativa sulla privacy",
		formLabel: "Modulo di richiesta",
		honeypot: "Lascia vuoto questo campo",
		antispamNoScript:
			"Per inviare il modulo serve attivare JavaScript (verifica antispam). In alternativa, chiamaci.",
	},
	en: {
		submit: "Send the request",
		required: "required",
		optional: "optional",
		consent: "I have read the privacy notice",
		privacyLink: "Privacy notice",
		formLabel: "Request form",
		honeypot: "Leave this field empty",
		antispamNoScript:
			"JavaScript is needed to send the form (spam check). Or give us a call.",
	},
};

const FIELD_NAME = /^[a-z][a-zA-Z0-9]*$/;
/** Campo trappola per i bot (honeypot): vuoto per le persone, il Worker scarta le richieste che lo riempiono. */
export const HONEYPOT_FIELD = "website";
/** Nomi riservati: li usa il form stesso. */
const RESERVED_NAMES = new Set(["consent", HONEYPOT_FIELD]);

export function assertValidFields(fields: readonly FormField[]): void {
	const seen = new Set<string>();
	for (const field of fields) {
		if (!FIELD_NAME.test(field.name) || RESERVED_NAMES.has(field.name)) {
			throw new Error(`Campo del modulo non valido: "${field.name}"`);
		}
		if (seen.has(field.name)) {
			throw new Error(`Campo del modulo ripetuto: "${field.name}"`);
		}
		seen.add(field.name);
	}
}

const emptyToUndefined = (value: unknown) =>
	typeof value === "string" && value.trim() === "" ? undefined : value;

const NAME_CONTROL = /[\p{Cc}\u2028\u2029]/u;

function isRealDate(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;
	const [year, month, day] = [
		Number(match[1]),
		Number(match[2]),
		Number(match[3]),
	];
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

function fieldSchema(field: FormField): z.ZodType {
	let inner: z.ZodType;
	let preprocess = emptyToUndefined;
	switch (field.kind) {
		case "email":
			inner = z.email().max(254);
			break;
		case "tel":
			preprocess = (value) =>
				typeof value === "string"
					? value.replace(/^ +| +$/g, "") || undefined
					: value;
			inner = z
				.string()
				.regex(/^\+?[0-9 ().-]{6,20}$/, "telefono non valido")
				.refine((value) => {
					const digits = value.replace(/[^0-9]/g, "").length;
					return digits >= 6 && digits <= 15;
				}, "il telefono deve avere da 6 a 15 cifre");
			break;
		case "date":
			inner = z.string().refine(isRealDate, "data non valida");
			break;
		case "time":
			inner = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "ora non valida");
			break;
		case "number":
			inner = z.coerce
				.number()
				.int()
				.min(field.min ?? 0)
				.max(field.max ?? 1_000_000);
			break;
		case "textarea":
			inner = z
				.string()
				.trim()
				.max(field.maxLength ?? 2000);
			break;
		default: {
			const text = z
				.string()
				.trim()
				.max(field.maxLength ?? 200);
			inner = text;
			if (field.name === "name") {
				preprocess = (value) =>
					typeof value === "string" && NAME_CONTROL.test(value)
						? value
						: emptyToUndefined(value);
				inner = z
					.string()
					.refine(
						(value) => !NAME_CONTROL.test(value),
						"caratteri non ammessi nel nome",
					)
					.pipe(text);
			}
		}
	}
	return field.required
		? z.preprocess(preprocess, inner)
		: z.preprocess(preprocess, inner.optional());
}

/**
 * Schema zod della richiesta, derivato dall'elenco dei campi. Il consenso (`consent`) è sempre
 * richiesto: casella spuntata (`"on"`, come la manda il browser). Se ci sono sia `email` sia
 * `phone` e nessuno dei due è obbligatorio, ne serve almeno uno (il browser non sa dirlo da solo).
 */
export function requestSchema(fields: readonly FormField[]) {
	assertValidFields(fields);
	const shape: Record<string, z.ZodType> = {};
	for (const field of fields) shape[field.name] = fieldSchema(field);
	shape.consent = z.literal("on");
	// Le persone non lo vedono e lo lasciano vuoto: un valore qui vuol dire bot.
	shape[HONEYPOT_FIELD] = z.string().max(0).optional();
	const eitherContact =
		fields.some((f) => f.name === "email" && !f.required) &&
		fields.some((f) => f.name === "phone" && !f.required);
	return z
		.object(shape)
		.refine(
			(data) =>
				!eitherContact ||
				Boolean((data as Record<string, unknown>).email) ||
				Boolean((data as Record<string, unknown>).phone),
			{ path: ["email"], message: "indica l'email o il telefono" },
		);
}

export interface ResolvedFormField {
	name: string;
	kind: FieldKind;
	required: boolean;
	label: string;
	hint?: string;
	autocomplete?: string;
	min?: number;
	max?: number;
	maxLength?: number;
}

export interface ContactFormModel {
	endpoint: string;
	/** Chiave pubblica di Turnstile: presente solo se `modules.antispam` è `turnstile`. */
	turnstileSiteKey?: string;
	honeypotName: string;
	privacyHref: string;
	labels: FormLabels;
	fields: ResolvedFormField[];
}

function requireFormEndpoint(value: string): string {
	const endpoint = parseFormEndpoint(value);
	if (!endpoint)
		throw new Error(
			"Indirizzo di invio del modulo non valido (serve https o un percorso del sito).",
		);
	return endpoint.href;
}

/**
 * Dati pronti per `ContactForm.astro`. La build si ferma (eccezione) se manca l'informativa
 * (02: link accanto al pulsante di invio) o se l'indirizzo di invio non è https.
 */
export function contactFormModel(options: {
	fields: readonly FormField[];
	language: Language;
	endpoint: string;
	privacyHref: string;
	/** Da `site.config.ts` (`modules.forms.turnstileSiteKey`), solo con `antispam: "turnstile"`. */
	turnstileSiteKey?: string;
}): ContactFormModel {
	const { fields, language, endpoint, privacyHref, turnstileSiteKey } = options;
	assertValidFields(fields);
	const canonicalEndpoint = requireFormEndpoint(endpoint);
	if (!isSiteLink(privacyHref)) {
		throw new Error(
			`Link all'informativa non valido: "${privacyHref}". Il modulo lo richiede accanto al pulsante di invio. La build si ferma.`,
		);
	}
	return {
		endpoint: canonicalEndpoint,
		turnstileSiteKey,
		honeypotName: HONEYPOT_FIELD,
		privacyHref,
		labels: FORM_LABELS[language],
		fields: fields.map((field) => ({
			name: field.name,
			kind: field.kind,
			required: field.required,
			label: field.label[language],
			hint: field.hint?.[language],
			autocomplete: field.autocomplete,
			min: field.min,
			max: field.max,
			maxLength: field.maxLength,
		})),
	};
}

export function contactFormForSite(
	config: Pick<SiteConfig, "modules" | "defaultLanguage">,
	language: Language,
	fields: readonly FormField[] = BASE_REQUEST_FIELDS,
): ContactFormModel {
	return contactFormModel({
		fields,
		language,
		...formSettings(config),
		privacyHref: pagePath(language, "privacy", config),
	});
}
