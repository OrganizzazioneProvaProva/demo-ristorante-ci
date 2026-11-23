import {
	BASE_REQUEST_FIELDS,
	type FormField,
	requestSchema,
} from "@siti/core/content/contact-form.ts";

export const BOOKING_FORM_ID = "prenota";

export const BOOKING_REQUEST_INTRO = {
	it: "Compila il modulo per richiedere un tavolo: ti risponderemo per confermare.",
	en: "Fill in the form to request a table: we will reply to confirm.",
};

/**
 * Richiesta di prenotazione di un tavolo: i campi comuni del core con data, ora e numero di
 * persone dopo il contatto. Il messaggio diventa "Note". È una richiesta, non una conferma:
 * il locale risponde (modulo di richiesta, 02 "Prenotazioni").
 */
export const BOOKING_REQUEST_FIELDS: readonly FormField[] = [
	...BASE_REQUEST_FIELDS.filter((field) => field.name !== "message"),
	{
		name: "date",
		kind: "date",
		required: true,
		label: { it: "Data", en: "Date" },
	},
	{
		name: "time",
		kind: "time",
		required: true,
		label: { it: "Ora", en: "Time" },
	},
	{
		name: "people",
		kind: "number",
		required: true,
		min: 1,
		max: 30,
		label: { it: "Numero di persone", en: "Number of guests" },
	},
	{
		name: "message",
		kind: "textarea",
		required: false,
		label: {
			it: "Note (allergie, seggiolone, occasione)",
			en: "Notes (allergies, high chair, occasion)",
		},
	},
];

// Il controllo di calendario nel Worker accetterà il giorno della ricezione in Europe/Rome
// e i giorni successivi. Lo schema condiviso verifica la data senza dipendere dall'orologio.
export const bookingRequestSchema = requestSchema(BOOKING_REQUEST_FIELDS);
