import { companyInfoSchema } from "@siti/core/content/company.ts";
import { content } from "./source.ts";

/** Dati aziendali: dal documento `companyInfo` (o dai dati finti, vedi `source.ts`). */
export const company = companyInfoSchema.parse(content.company);

/**
 * Punto inventato in Sicilia (centro di Piazza Armerina) per il link "Mappa": con una
 * coppia `lat,lng` il link porta a quel punto preciso, senza dipendere dall'indirizzo.
 */
export const MAP_QUERY = "37.3856,14.3708";
