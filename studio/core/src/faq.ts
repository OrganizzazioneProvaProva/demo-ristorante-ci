import { defineField, defineType } from "sanity";

/** Una domanda frequente con la sua risposta, per lingua (la domanda dell'italiano è obbligatoria). */
export const faqItemType = defineType({
	name: "faqItem",
	title: "Domanda",
	type: "object",
	fields: [
		defineField({
			name: "question",
			title: "Domanda",
			type: "localeString",
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: "answer",
			title: "Risposta",
			type: "localeText",
			validation: (rule) => rule.required(),
		}),
	],
	preview: { select: { title: "question.it", subtitle: "answer.it" } },
});

/**
 * Domande frequenti: un solo documento per sito, con il titolo della sezione (facoltativo: senza,
 * il sito usa «Domande frequenti») e fino a 20 domande. Una domanda senza traduzione non compare
 * nell'altra lingua. In fondo alla sezione il sito invita a scrivere: i due testi si possono
 * cambiare qui.
 */
export const faqType = defineType({
	name: "faq",
	title: "Domande frequenti",
	type: "document",
	fields: [
		defineField({
			name: "title",
			title: "Titolo della sezione (facoltativo)",
			type: "localeString",
		}),
		defineField({
			name: "subtitle",
			title: "Sottotitolo (facoltativo)",
			type: "localeString",
		}),
		defineField({
			name: "items",
			title: "Domande",
			type: "array",
			of: [{ type: "faqItem" }],
			validation: (rule) => rule.required().min(1).max(20),
		}),
		defineField({
			name: "contactTitle",
			title: "Titolo dell'invito a scrivere (facoltativo)",
			type: "localeString",
			description: "Per esempio «Hai ancora dubbi?».",
		}),
		defineField({
			name: "contactText",
			title: "Testo dell'invito a scrivere (facoltativo)",
			type: "localeText",
		}),
	],
	preview: { prepare: () => ({ title: "Domande frequenti" }) },
});
