import { MENU_CLASSES } from "./menu-classes.ts";

/**
 * Classi "sonda" del preset per `run-check-site.ts --probe`: arrivano nel CSS del sito solo se
 * `preset.css` è importato (e quindi `@source` del preset funziona).
 */
export const PROBE_CLASSES: string[] = [
	...MENU_CLASSES.featured.split(" "),
	...MENU_CLASSES.itemList.split(" "),
];
