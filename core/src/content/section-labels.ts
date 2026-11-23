import type { Language } from "@siti/config";

/** Testi fissi di avvisi, promozioni e galleria, in tutte le lingue del core (IT+EN): nessun ripiego. */
export interface SectionLabels {
	notices: string;
	promotions: string;
	promotionUntil: string;
	promotionLink: string;
	gallery: string;
	galleryRegion: string;
	faq: string;
	faqContactTitle: string;
	faqContactText: string;
	testimonials: string;
	testimonialRating: string;
	galleryPrevious: string;
	galleryNext: string;
	gallerySlide: string;
	galleryCarousel: string;
	gallerySlideRole: string;
	galleryOpen: string;
	galleryClose: string;
	galleryDialog: string;
}

export const SECTION_LABELS: Record<Language, SectionLabels> = {
	it: {
		notices: "Avvisi",
		promotions: "Promozioni",
		promotionUntil: "Fino al {date}",
		promotionLink: "Scopri di più",
		gallery: "Galleria",
		galleryRegion: "Foto del locale: scorri per vederle tutte",
		faq: "Domande frequenti",
		faqContactTitle: "Hai ancora dubbi?",
		faqContactText: "Scrivici: ti rispondiamo il prima possibile.",
		testimonials: "Cosa dicono i nostri clienti",
		testimonialRating: "{n} su 5",
		galleryPrevious: "Foto precedente",
		galleryNext: "Foto successiva",
		gallerySlide: "Foto {n} di {total}",
		galleryCarousel: "carosello",
		gallerySlideRole: "diapositiva",
		galleryOpen: "Ingrandisci la foto {n} di {total}",
		galleryClose: "Chiudi la foto ingrandita",
		galleryDialog: "Foto ingrandita",
	},
	en: {
		notices: "Notices",
		promotions: "Offers",
		promotionUntil: "Until {date}",
		promotionLink: "Learn more",
		gallery: "Gallery",
		galleryRegion: "Photos of the place: scroll to see them all",
		faq: "Frequently asked questions",
		faqContactTitle: "Still have questions?",
		faqContactText: "Write to us: we reply as soon as we can.",
		testimonials: "What our customers say",
		testimonialRating: "{n} out of 5",
		galleryPrevious: "Previous photo",
		galleryNext: "Next photo",
		gallerySlide: "Photo {n} of {total}",
		galleryCarousel: "carousel",
		gallerySlideRole: "slide",
		galleryOpen: "Enlarge photo {n} of {total}",
		galleryClose: "Close the enlarged photo",
		galleryDialog: "Enlarged photo",
	},
};

/** Giorno per esteso nella lingua ("30 novembre 2026"), da una data AAAA-MM-GG, senza fuso. */
export function formatDay(value: string, language: Language): string {
	return new Intl.DateTimeFormat(language === "it" ? "it-IT" : "en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(`${value}T00:00:00Z`));
}
