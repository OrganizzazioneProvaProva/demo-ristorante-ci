import type { Language, SiteConfig } from "@siti/config";
import { z } from "zod";
import { localizedTextSchema, textIn } from "./localized.ts";

/**
 * Domande frequenti come arrivano da Sanity (documento singolo `faq`): titolo e sottotitolo della
 * sezione, le domande con le risposte per lingua e, facoltativi, i testi dell'invito a scrivere in
 * fondo. Senza titolo si usa quello del core.
 */
export const rawFaqSchema = z.object({
	title: localizedTextSchema.nullish(),
	subtitle: localizedTextSchema.nullish(),
	items: z
		.array(
			z.object({
				question: localizedTextSchema,
				answer: localizedTextSchema,
			}),
		)
		.max(20),
	contactTitle: localizedTextSchema.nullish(),
	contactText: localizedTextSchema.nullish(),
});
export type RawFaq = z.infer<typeof rawFaqSchema>;

export interface ResolvedFaq {
	title?: string;
	subtitle?: string;
	items: Array<{ question: string; answer: string }>;
	contactTitle?: string;
	contactText?: string;
}

/**
 * Le domande nella lingua richiesta. Una domanda si mostra solo se ha domanda E risposta in quella
 * lingua (nessun ripiego): in italiano, la lingua principale, una voce incompleta ferma la build.
 * Se non resta nessuna domanda la sezione non esiste (`undefined`).
 */
export function resolveFaq(
	rawFaq: unknown,
	language: Language,
	config: Pick<SiteConfig, "defaultLanguage">,
): ResolvedFaq | undefined {
	const faq = rawFaqSchema.parse(rawFaq);
	const items: ResolvedFaq["items"] = [];
	faq.items.forEach((item, index) => {
		const question = textIn(item.question, language);
		const answer = textIn(item.answer, language);
		if (question && answer) {
			items.push({ question, answer });
		} else if (language === config.defaultLanguage) {
			throw new Error(
				`FAQ, voce ${index + 1}: in ${language} (lingua principale) mancano domanda o risposta. La build si ferma.`,
			);
		}
	});
	if (items.length === 0) return undefined;
	const pick = (value: RawFaq["title"]) =>
		value ? textIn(value, language) : undefined;
	return {
		title: pick(faq.title),
		subtitle: pick(faq.subtitle),
		items,
		contactTitle: pick(faq.contactTitle),
		contactText: pick(faq.contactText),
	};
}
