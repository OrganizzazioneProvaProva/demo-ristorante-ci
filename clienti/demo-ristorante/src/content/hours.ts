import { openingHoursSchema } from "@siti/core/content/opening-hours.ts";
import { content } from "./source.ts";

/** Orari di apertura: dal documento `openingHours` (o dai dati finti, vedi `source.ts`). */
export const hours = openingHoursSchema.parse(content.hours);
