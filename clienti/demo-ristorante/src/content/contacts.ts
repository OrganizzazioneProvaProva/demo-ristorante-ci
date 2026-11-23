import type { Language } from "@siti/config";
import { contactFormForSite } from "@siti/core/content/contact-form.ts";
import {
	type ResolvedBooking,
	rawContactsSchema,
	resolveSiteBooking,
} from "@siti/core/content/contacts.ts";
import {
	BOOKING_FORM_ID,
	BOOKING_REQUEST_FIELDS,
} from "@siti/preset-ristorante/booking";
import { config, pagePath } from "./home.ts";
import { content } from "./source.ts";

export const rawContacts = rawContactsSchema.parse(content.contacts);

export function bookingFor(language: Language) {
	return resolveSiteBooking(
		config,
		rawContacts,
		`${pagePath(language, "contatti", config)}#${BOOKING_FORM_ID}`,
	);
}

export function bookingFormFor(language: Language, booking: ResolvedBooking) {
	return contactFormForSite(
		config,
		language,
		booking.form === "booking" ? BOOKING_REQUEST_FIELDS : undefined,
	);
}
