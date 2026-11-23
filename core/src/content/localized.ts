import { type Language, SUPPORTED_LANGUAGES } from "@siti/config";
import { z } from "zod";

const maybeText = z.string().nullish();

/**
 * Valore per lingua come lo restituisce Sanity: ogni lingua può mancare o essere `null`
 * (campo mai compilato). Le chiavi sconosciute (per esempio `_type`) vengono scartate.
 */
export const localizedTextSchema = z.object(
	Object.fromEntries(
		SUPPORTED_LANGUAGES.map((language) => [language, maybeText]),
	) as Record<Language, typeof maybeText>,
);
export type LocalizedText = z.infer<typeof localizedTextSchema>;

/** Il testo nella lingua richiesta, oppure `undefined` se manca o è vuoto. Nessun ripiego. */
export function textIn(
	value: LocalizedText,
	language: Language,
): string | undefined {
	const text = value[language]?.trim();
	return text ? text : undefined;
}
