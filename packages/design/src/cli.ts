#!/usr/bin/env node
// Uso: siti-design build <DESIGN.md> --out <file.css>
// Convalida il DESIGN.md (schema, sezioni, contrasto) e scrive il CSS dei valori.
// Esce con codice 1 se qualcosa non va: nel build del sito blocca la pubblicazione.
import { writeThemeCss } from "./build.ts";

const [command, input, flag, output] = process.argv.slice(2);
if (command !== "build" || !input || flag !== "--out" || !output) {
	console.error("Uso: siti-design build <DESIGN.md> --out <file.css>");
	process.exit(2);
}

try {
	const { tokens, findings } = writeThemeCss(input, output);
	const worst = Math.min(...findings.map((f) => f.ratio));
	console.log(
		`OK: "${tokens.name}" → ${output} (${findings.length} controlli di contrasto, il più basso ${worst.toFixed(2)}:1)`,
	);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
