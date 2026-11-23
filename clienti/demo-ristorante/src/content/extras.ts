import type { Language } from "@siti/config";
import { resolveFaq } from "@siti/core/content/faq.ts";
import { resolveTestimonials } from "@siti/core/content/testimonials.ts";
import { config } from "./home.ts";
import { content } from "./source.ts";

/** Domande frequenti nella lingua: dal documento `faq` (se non esiste, la sezione non compare). */
export function faqFor(language: Language) {
	return content.faq ? resolveFaq(content.faq, language, config) : undefined;
}

/** Testimonianze nella lingua: dai documenti `testimonial`. */
export function testimonialsFor(language: Language) {
	return resolveTestimonials(content.testimonials, language, config);
}
