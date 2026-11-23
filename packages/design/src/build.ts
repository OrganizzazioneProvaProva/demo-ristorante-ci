import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { type ParsedDesign, parseDesignMd } from "./design-md.ts";
import { themeCss } from "./output.ts";

/**
 * Legge e convalida un DESIGN.md (schema, sezioni, contrasto) e scrive il CSS dei valori.
 * Lancia con l'elenco dei problemi se qualcosa non va. Lo usano `astro.config.mjs` dei siti
 * (così `dev`, `build` e `check` rigenerano il file da soli) e la CLI `siti-design`.
 */
export function writeThemeCss(
	designMdPath: string | URL,
	cssPath: string | URL,
): ParsedDesign {
	const parsed = parseDesignMd(readFileSync(designMdPath, "utf8"));
	const cssFile = cssPath instanceof URL ? fileURLToPath(cssPath) : cssPath;
	mkdirSync(dirname(cssFile), { recursive: true });
	writeFileSync(cssFile, themeCss(parsed.tokens));
	return parsed;
}
