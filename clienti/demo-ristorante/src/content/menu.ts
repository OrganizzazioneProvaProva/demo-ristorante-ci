import { writeFileSync } from "node:fs";
import type { Language } from "@siti/config";
import { resolveMenu } from "@siti/preset-ristorante/menu";
import { config } from "./home.ts";
import { content } from "./source.ts";

/** Menu: dal documento `menu` (o dai dati finti, vedi `source.ts`). */
export const rawMenu = content.menu;

// The test runner supplies a fresh path outside the publishable dist.
const snapshotPath = process.env.SITI_MENU_SNAPSHOT_PATH;
if (snapshotPath) {
	writeFileSync(snapshotPath, JSON.stringify(rawMenu), {
		flag: "wx",
		mode: 0o600,
	});
}

export function menuFor(language: Language) {
	return resolveMenu(rawMenu, language, config);
}
