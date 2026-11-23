import {
	type BookingMode,
	contentHttpsHostname,
	isSocialUrl,
	type SocialKind,
	whatsappDigits,
} from "@siti/config";
import { defineField, defineType } from "sanity";

/** Opzioni del documento: `booking` arriva da `site.config.ts` (`modules.booking`). */
export interface ContactsOptions {
	booking?: BookingMode;
}

/** Campo con l'indirizzo del profilo social: https e solo l'host del servizio (le stesse regole del sito). */
function socialField(kind: SocialKind, name: string, title: string) {
	const service = title.replace(" (facoltativo)", "");
	return defineField({
		name,
		title,
		type: "url",
		description: `L'indirizzo della pagina ${service} dell'attività. Se lo lasci vuoto, il pulsante non compare nel piè di pagina.`,
		validation: (rule) =>
			rule
				.uri({ scheme: ["https"], allowRelative: false })
				.custom((value) =>
					value === undefined || isSocialUrl(kind, String(value))
						? true
						: `Serve un indirizzo https di ${service}.`,
				),
	});
}

/**
 * Contatti e prenotazioni: un solo documento per sito. Il link a una piattaforma di prenotazione
 * esterna (TheFork e simili), il numero WhatsApp e i profili social: quelli compilati compaiono
 * nel piè di pagina, gli altri no. Con `modules.booking = request`, se resta
 * vuoto il pulsante "Prenota" porta al modulo di richiesta del sito; con `external` è obbligatorio
 * (senza, la build si ferma). Con `none` il sito non ha prenotazioni e il campo si nasconde: non si
 * toglie, così un valore già inserito non va perso (02: mai togliere un campo in un passo solo).
 * Solo https: il sito non apre altri tipi di link.
 */
export function contactsType(options: ContactsOptions = {}) {
	const booking = options.booking ?? "request";
	return defineType({
		name: "contacts",
		title: "Contatti e prenotazioni",
		type: "document",
		fields: [
			defineField({
				name: "bookingUrl",
				title:
					booking === "external"
						? "Link di prenotazione"
						: "Link di prenotazione (facoltativo)",
				type: "url",
				hidden: booking === "none",
				description:
					booking === "external"
						? "L'indirizzo della piattaforma dove i clienti prenotano. Senza, la pubblicazione del sito si ferma."
						: "L'indirizzo della piattaforma dove i clienti prenotano. Se lo lasci vuoto, il pulsante «Prenota» porta al modulo di richiesta del sito.",
				validation: (rule) => {
					const https = rule.custom((value) =>
						value === undefined || contentHttpsHostname(value)
							? true
							: "Serve un indirizzo https valido senza credenziali, IP o localhost.",
					);
					return booking === "external" ? https.required() : https;
				},
			}),
			defineField({
				name: "whatsapp",
				title: "Numero WhatsApp (facoltativo)",
				type: "string",
				description:
					"In formato internazionale, per esempio +39 333 1234567. Se lo lasci vuoto, il pulsante WhatsApp non compare.",
				validation: (rule) =>
					rule.custom((value) =>
						value === undefined || whatsappDigits(String(value)) !== undefined
							? true
							: "Serve il formato internazionale, per esempio +39 333 1234567.",
					),
			}),
			socialField("instagram", "instagramUrl", "Instagram (facoltativo)"),
			socialField("facebook", "facebookUrl", "Facebook (facoltativo)"),
			socialField("tiktok", "tiktokUrl", "TikTok (facoltativo)"),
		],
		preview: { prepare: () => ({ title: "Contatti e prenotazioni" }) },
	});
}
