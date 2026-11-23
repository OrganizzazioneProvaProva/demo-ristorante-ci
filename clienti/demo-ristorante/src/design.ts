import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDesignMd, fontVariables as variablesOf } from "@siti/design";

/**
 * Il DESIGN.md del sito: l'unico posto dove stanno i valori del design (02). Il percorso
 * parte dalla cartella del sito (dove si lancia la build), non da `import.meta.url`: nella
 * build questo file finisce in `dist/.prerender` e un percorso relativo si romperebbe.
 */
export const design = parseDesignMd(
	readFileSync(resolve(process.cwd(), "DESIGN.md"), "utf8"),
);

export const fontVariables = variablesOf(design.tokens);
export const motion = design.tokens.motion;
