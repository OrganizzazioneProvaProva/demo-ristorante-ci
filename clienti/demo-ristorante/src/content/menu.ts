import type { Language } from "@siti/config";
import { resolveMenu } from "@siti/preset-ristorante/menu";
import { config } from "./home.ts";
import { content } from "./source.ts";

/** Menu: dal documento `menu` (o dai dati finti, vedi `source.ts`). */
export const rawMenu = content.menu;

export function menuFor(language: Language) {
	return resolveMenu(rawMenu, language, config);
}
