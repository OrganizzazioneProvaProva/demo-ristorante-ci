import { defineField } from "sanity";
import {
	LANGUAGE_TITLES,
	type LocaleOptions,
	orderedLanguages,
} from "./locale.ts";

/**
 * Traduzioni obbligatorie per i documenti con una pagina (home, pagina): in ogni lingua ATTIVA
 * i testi di tipo `localeStringRequired`/`localeTextRequired` sono obbligatori, altrimenti la
 * pubblicazione è bloccata (un errore, non un avviso). Il titolare può dichiarare di voler
 * pubblicare solo nella lingua principale con questo campo. La build resta comunque una rete
 * di sicurezza (le scritture via API non passano dallo Studio): una traduzione mancante salta
 * la pagina e viene segnalata.
 */
export const ONLY_DEFAULT_LANGUAGE_FIELD = "onlyDefaultLanguage";

export function onlyDefaultLanguageField(options: LocaleOptions) {
	return defineField({
		name: ONLY_DEFAULT_LANGUAGE_FIELD,
		title: `Pubblica solo in ${LANGUAGE_TITLES[options.defaultLanguage]}`,
		type: "boolean",
		initialValue: false,
		description:
			"Spento (consigliato): ogni lingua del sito va compilata, altrimenti non puoi pubblicare. Acceso: scegli di non tradurre questa pagina, che esisterà solo nella lingua principale.",
		hidden: orderedLanguages(options).length < 2,
	});
}
