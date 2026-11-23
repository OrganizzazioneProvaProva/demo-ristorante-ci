import type { Language } from "@siti/config";
import { type PathSegment, valueAtPath } from "@siti/config";
import { defineField, defineType } from "sanity";
import { requiresImageAlt } from "./site-image.ts";

/** Opzioni del plugin: arrivano da site.config.ts del cliente (già validato da @siti/config). */
export interface LocaleOptions {
	languages: readonly Language[];
	defaultLanguage: Language;
}

export const LANGUAGE_TITLES: Record<Language, string> = {
	it: "Italiano",
	en: "English",
};

/** La lingua principale sta per prima, le altre seguono nell'ordine di site.config.ts. */
export function orderedLanguages({
	languages,
	defaultLanguage,
}: LocaleOptions): Language[] {
	return [
		defaultLanguage,
		...languages.filter((language) => language !== defaultLanguage),
	];
}

/**
 * Il titolare ha scelto di pubblicare il documento solo nella lingua principale
 * (`onlyDefaultLanguage`): le traduzioni mancanti non sono né un avviso né un errore.
 */
export function publishesDefaultLanguageOnly(context: FieldContext): boolean {
	const document = context.document as
		| { onlyDefaultLanguage?: unknown }
		| undefined;
	return document?.onlyDefaultLanguage === true;
}

/** Contesto minimo di una validazione personalizzata di Sanity che serve a questi tipi. */
export interface FieldContext {
	document?: unknown;
	path?: readonly PathSegment[];
	hidden?: boolean;
}

/**
 * Un campo per lingua dentro un oggetto. La lingua principale è obbligatoria; le altre
 * generano solo un avviso, così il cliente può pubblicare: la pagina in quella lingua
 * però non viene generata finché la traduzione manca (decisione di comportamento "a").
 * Con la localizzazione a livello di campo si pubblicano tutte le lingue insieme.
 *
 * `requiredWhen` rende la lingua principale obbligatoria solo se la condizione è vera
 * (serve al testo alternativo, che non è richiesto per le immagini decorative).
 */
function localeFields(
	kind: "string" | "text",
	options: LocaleOptions,
	requiredWhen?: (context: FieldContext) => boolean,
	missingWarning?: (context: FieldContext, language: Language) => string,
	requireTranslation = false,
) {
	return orderedLanguages(options).map((language) =>
		defineField({
			name: language,
			title: LANGUAGE_TITLES[language],
			type: kind,
			...(kind === "text" ? { rows: 3 } : {}),
			validation: (rule) => {
				if (language !== options.defaultLanguage && requireTranslation) {
					// Traduzione OBBLIGATORIA (home, pagine): un errore che blocca la pubblicazione,
					// salvo che il titolare scelga di non tradurre (`onlyDefaultLanguage`). Il
					// controllo sta sul campo della lingua: sul documento intero il validatore di
					// Sanity lo declassa ad avviso.
					return rule.custom((value, context) => {
						if (
							publishesDefaultLanguageOnly(context as unknown as FieldContext)
						) {
							return true;
						}
						return typeof value === "string" && value.trim()
							? true
							: `Manca la traduzione in ${LANGUAGE_TITLES[language]}: compilala, oppure attiva «Pubblica solo in ${LANGUAGE_TITLES[options.defaultLanguage]}» per scegliere di non tradurre questa pagina.`;
					});
				}
				if (language !== options.defaultLanguage && missingWarning) {
					return rule
						.custom((value, context) => {
							const ctx = context as unknown as FieldContext;
							if (requiredWhen && !requiredWhen(ctx)) return true;
							return typeof value === "string" && value.trim()
								? true
								: missingWarning(ctx, language);
						})
						.warning();
				}
				if (language !== options.defaultLanguage) {
					return rule
						.custom((value, context) => {
							if (
								publishesDefaultLanguageOnly(context as unknown as FieldContext)
							) {
								return true;
							}
							return typeof value === "string" && value.trim()
								? true
								: `Manca la traduzione in ${LANGUAGE_TITLES[language]}.`;
						})
						.warning();
				}
				if (!requiredWhen) return rule.required();
				// Un controllo personalizzato su un campo semplice è un errore che blocca la
				// pubblicazione (quelli su campi-oggetto il validatore di Sanity li emette come avviso).
				return rule.custom((value, context) =>
					requiredWhen(context as unknown as FieldContext) &&
					!(typeof value === "string" && value.trim())
						? "Obbligatorio."
						: true,
				);
			},
		}),
	);
}

/** Avviso sull'alt non tradotto: dipende da "informativa" (vedi `resolveImage` nel core). */
export function missingAltWarning(
	context: FieldContext,
	language: Language,
): string {
	const imagePath = (context.path ?? []).slice(0, -2);
	const informative =
		valueAtPath(context.document, [...imagePath, "informative"]) === true;
	const title = LANGUAGE_TITLES[language];
	return informative
		? `Manca il testo alternativo in ${title}: l'immagine non comparirà nella pagina in ${title}.`
		: `Manca il testo alternativo in ${title}: la foto comparirà con il testo italiano (segnalato come tale).`;
}

function imagePathRequiresAlt(context: FieldContext): boolean {
	// percorso del campo: [...immagine, "alt", "<lingua>"]: l'immagine è due livelli sopra.
	const imagePath = (context.path ?? []).slice(0, -2);
	return (
		!context.hidden &&
		requiresImageAlt(valueAtPath(context.document, imagePath))
	);
}

export function localeStringType(options: LocaleOptions) {
	return defineType({
		name: "localeString",
		title: "Testo breve per lingua",
		type: "object",
		fields: localeFields("string", options),
	});
}

/** Come `localeString`, ma ogni lingua attiva è obbligatoria (titoli di home e pagine). */
export function localeStringRequiredType(options: LocaleOptions) {
	return defineType({
		name: "localeStringRequired",
		title: "Testo breve per lingua (tutte le lingue obbligatorie)",
		type: "object",
		fields: localeFields("string", options, undefined, undefined, true),
	});
}

/** Come `localeText`, ma ogni lingua attiva è obbligatoria (descrizioni di home e pagine). */
export function localeTextRequiredType(options: LocaleOptions) {
	return defineType({
		name: "localeTextRequired",
		title: "Testo lungo per lingua (tutte le lingue obbligatorie)",
		type: "object",
		fields: localeFields("text", options, undefined, undefined, true),
	});
}

export function localeTextType(options: LocaleOptions) {
	return defineType({
		name: "localeText",
		title: "Testo lungo per lingua",
		type: "object",
		fields: localeFields("text", options),
	});
}

/**
 * Testo alternativo per lingua (02: obbligatorio, con l'opzione "decorativa"). L'italiano è
 * obbligatorio solo per un file selezionato e non decorativo.
 */
export function altTextType(options: LocaleOptions) {
	return defineType({
		name: "altText",
		title: "Testo alternativo per lingua",
		type: "object",
		fields: localeFields(
			"string",
			options,
			imagePathRequiresAlt,
			missingAltWarning,
		),
	});
}
