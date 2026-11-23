import type { CompanyInfo } from "@siti/core/content/company.ts";
import { localBusinessJsonLd } from "@siti/core/content/json-ld.ts";
import type { OpeningHours } from "@siti/core/content/opening-hours.ts";

/** Tipi schema.org dei locali di ristorazione che questo preset copre (`11` §4.1). */
export type RestaurantType = "Restaurant" | "BarOrPub" | "CafeOrCoffeeShop";

export interface RestaurantJsonLdInput {
	type?: RestaurantType;
	company: CompanyInfo;
	/** Indirizzo assoluto della home nella lingua della pagina (con barra finale). */
	url: string;
	/** Indirizzo assoluto della home nella lingua principale: dà lo stesso `@id` in ogni lingua. */
	idUrl?: string;
	hours?: OpeningHours;
	/** Oggi alla build (AAAA-MM-GG). */
	today: string;
	geo?: string;
	/** Tipi di cucina in inglese per schema.org (per esempio `["Pizza", "Sicilian"]`): solo se il titolare li dichiara. */
	cuisine?: string[];
	/** Indirizzo assoluto della pagina del menu. */
	menuUrl?: string;
	/** Indirizzo (https) del modulo di prenotazione, se esiste: diventa `acceptsReservations`. */
	bookingUrl?: string;
}

/**
 * Dati strutturati del ristorante: l'attività locale del core più `servesCuisine`, `menu` e
 * `acceptsReservations`, ciascuno SOLO se il dato esiste. Niente `priceRange` né immagini
 * inventate. `acceptsReservations` come URL è ammesso da schema.org (Boolean, Text o URL).
 */
export function restaurantJsonLd(
	input: RestaurantJsonLdInput,
): Record<string, unknown> {
	if (
		input.bookingUrl !== undefined &&
		!input.bookingUrl.startsWith("https://")
	) {
		throw new Error(
			`bookingUrl nel JSON-LD deve essere un indirizzo https assoluto (non un percorso del sito): ${input.bookingUrl}. La build si ferma.`,
		);
	}
	return localBusinessJsonLd({
		type: input.type ?? "Restaurant",
		company: input.company,
		url: input.url,
		...(input.idUrl ? { idUrl: input.idUrl } : {}),
		today: input.today,
		...(input.hours ? { hours: input.hours } : {}),
		...(input.geo ? { geo: input.geo } : {}),
		extra: {
			...(input.cuisine?.length ? { servesCuisine: input.cuisine } : {}),
			...(input.menuUrl ? { menu: input.menuUrl } : {}),
			...(input.bookingUrl ? { acceptsReservations: input.bookingUrl } : {}),
		},
	});
}
