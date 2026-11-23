import { defineField, defineType } from "sanity";

/**
 * Testimonianza di un cliente, scritta dal titolare. Va inserita solo con il consenso di chi parla
 * (nome compreso): ne risponde il titolare. Il testo si può tradurre; senza traduzione il sito
 * mostra l'originale con la sua lingua, senza tradurlo al posto del cliente. Nessuna foto.
 */
export const testimonialType = defineType({
	name: "testimonial",
	title: "Testimonianza",
	type: "document",
	fields: [
		defineField({
			name: "author",
			title: "Nome (come vuole comparire)",
			type: "string",
			description:
				"Anche solo il nome o le iniziali. Inseriscilo solo se la persona è d'accordo.",
			validation: (rule) => rule.required().max(60),
		}),
		defineField({
			name: "role",
			title: "Ruolo o fonte (facoltativo)",
			type: "localeString",
			description: "Per esempio «Cliente abituale».",
		}),
		defineField({
			name: "rating",
			title: "Stelle (facoltative)",
			type: "number",
			validation: (rule) => rule.integer().min(1).max(5),
		}),
		defineField({
			name: "text",
			title: "Testo",
			type: "localeText",
			validation: (rule) => rule.required(),
		}),
	],
	preview: { select: { title: "author", subtitle: "text.it" } },
});
