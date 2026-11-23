import {
	type BookingMode,
	bookingMode,
	type ContentLinkPolicy,
	isSocialUrl,
	requireContentHttpsLink,
	type SiteConfig,
	whatsappDigits,
} from "@siti/config";
import { z } from "zod";
import { contentHttpsLinkSchema } from "./links.ts";

/**
 * Contatti e prenotazioni come arrivano da Sanity (documento `contacts`, uno per sito).
 * `bookingUrl` è il link a una piattaforma esterna (TheFork e simili): se c'è, il pulsante
 * "Prenota" porta lì; se manca, porta al modulo di richiesta del sito.
 */
export const rawContactsSchema = z.object({
	bookingUrl: contentHttpsLinkSchema.nullish(),
	/** Numero WhatsApp in formato internazionale: il sito ne ricava il link `wa.me`. */
	whatsapp: z
		.string()
		.refine(
			(value) => whatsappDigits(value) !== undefined,
			"numero in formato internazionale, per esempio +39 333 1234567",
		)
		.nullish(),
	instagramUrl: z
		.string()
		.refine(
			(value) => isSocialUrl("instagram", value),
			"indirizzo https di Instagram",
		)
		.nullish(),
	facebookUrl: z
		.string()
		.refine(
			(value) => isSocialUrl("facebook", value),
			"indirizzo https di Facebook",
		)
		.nullish(),
	tiktokUrl: z
		.string()
		.refine(
			(value) => isSocialUrl("tiktok", value),
			"indirizzo https di TikTok",
		)
		.nullish(),
});
export type RawContacts = z.infer<typeof rawContactsSchema>;

/** Quali campi usa il form della pagina Contatti: per una prenotazione o una richiesta generica. */
export type ContactFormKind = "booking" | "contact";

export interface ResolvedBooking {
	mode: BookingMode;
	/** Destinazione del pulsante «Prenota»; assente se il sito non ha prenotazioni. */
	href?: string;
	form: ContactFormKind;
}

/**
 * L'unica fonte per tutto ciò che riguarda le prenotazioni: pulsante «Prenota», `acceptsReservations`
 * nel JSON-LD e campi del form leggono questo risultato, quindi non possono contraddirsi.
 * - `none`: nessuna prenotazione. Un `bookingUrl` rimasto nello Studio si ignora con un avviso nel log
 *   (fermare la build per un contenuto del titolare bloccherebbe le sue pubblicazioni);
 * - `request`: il link esterno se c'è, altrimenti il modulo del sito (`formHref`);
 * - `external`: serve il link (https): senza, la build si ferma.
 */
export function resolveBooking(
	mode: BookingMode,
	contacts: RawContacts | null | undefined,
	formHref: string,
): ResolvedBooking {
	const external = contacts?.bookingUrl ?? undefined;
	switch (mode) {
		case "none":
			if (external) {
				console.warn(
					"[prenotazioni] il sito non ha prenotazioni (modules.booking = none): il link di prenotazione nello Studio è ignorato.",
				);
			}
			return { mode, form: "contact" };
		case "external":
			if (!external) {
				throw new Error(
					"modules.booking = external: serve il link di prenotazione (documento «Contatti e prenotazioni» dello Studio). La build si ferma.",
				);
			}
			return { mode, href: external, form: "contact" };
		default:
			return { mode, href: external ?? formHref, form: "booking" };
	}
}

export function resolveSiteBooking(
	config: Pick<SiteConfig, "modules"> & ContentLinkPolicy,
	contacts: RawContacts | null | undefined,
	formHref: string,
): ResolvedBooking {
	if (contacts?.bookingUrl)
		requireContentHttpsLink(contacts.bookingUrl, "contacts.bookingUrl", config);
	return resolveBooking(bookingMode(config), contacts, formHref);
}
