import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Regole statiche sul codice dei componenti (core e, in seguito, preset). Tengono insieme
 * il vocabolario di classi dei nostri ruoli e le regole di 04: ogni violazione è un errore.
 * Per ogni regola c'è il motivo; se una regola va allentata, si cambia qui e in `09`.
 */
export interface Violation {
	file: string;
	line: number;
	rule: string;
	excerpt: string;
}

const UTILITIES =
	"bg|text|border|ring|outline|fill|stroke|from|via|to|divide|decoration|shadow|caret|accent";
const ROLES =
	"bg|surface|ink|muted|line|accent-ink|accent-hover|accent|pop-ink|pop";
const SHADCN =
	"background|foreground|primary-foreground|primary|secondary-foreground|secondary|destructive|popover-foreground|popover|card-foreground|card|input|muted-foreground|accent-foreground|ring";

interface Rule {
	name: string;
	pattern: RegExp;
	/** File (percorso relativo, con `/`) dove la regola non si applica. */
	allow?: string[];
}

export const RULES: Rule[] = [
	{
		// 04 §3: un solo componente con HTML grezzo, il JSON-LD con l'escape dei caratteri
		name: "set:html fuori dal componente JSON-LD (04)",
		pattern: /\bset:html\b/,
		allow: ["components/JsonLd.astro"],
	},
	{
		// un solo tema per sito: le varianti scure di librerie copiate non devono arrivare nel core
		name: "variante dark: (nessuna modalità scura)",
		pattern: /(?:^|[\s"'`:{}])dark:/,
	},
	{
		// il contrasto reale di `bg-accent/80` dipende dallo sfondo e la pipeline dei contrasti
		// non lo vede: gli stati sono colori derivati (accent-hover)
		name: "opacità su un ruolo (usare uno stato derivato)",
		pattern: new RegExp(`\\b(?:${UTILITIES})-(?:${ROLES})\\/(?:\\d|\\[)`),
	},
	{
		// l'anello di focus lo dà il core (theme.css, 3 px accent, WCAG 2.4.7/2.4.11)
		name: "outline-none/outline-hidden (toglie l'anello di focus del core)",
		pattern: /\boutline-(?:none|hidden)\b/,
	},
	{
		// un solo valore per gli angoli di tutto il sito (`rounded.ui` del DESIGN.md → `rounded-ui`):
		// pulsanti, schede, immagini e campi cambiano insieme. Cerchi (`rounded-full`) e angoli vivi
		// (`rounded-none`) sono ammessi; `rounded-lg`, `rounded-[8px]` o `rounded` da soli no.
		name: "angoli: usare rounded-ui (il raggio è un valore solo del DESIGN.md)",
		pattern:
			/\brounded(?!-(?:(?:t|r|b|l|s|e|tl|tr|bl|br|ss|se|ee|es)-)?(?:ui|full|none)\b)(?:-[a-z0-9[]\S*|(?![-\w]))/,
	},
	{
		// vocabolario di Fulldev/shadcn: nei nostri componenti si usano solo i nove ruoli
		name: "token shadcn al posto dei ruoli del core",
		pattern: new RegExp(`\\b(?:${UTILITIES})-(?:${SHADCN})\\b(?!-)`),
	},
];

/**
 * Il testo si scansiona GREZZO, commenti compresi: Tailwind legge anche quelli (per questo
 * una classe citata in un commento genera CSS in ogni sito) e un tentativo di togliere i
 * commenti con espressioni regolari lascia buchi (un `/*` dentro una stringa, un `//` nel
 * testo). Il prezzo: i commenti non possono citare la sintassi vietata.
 */
export function scanSource(file: string, text: string): Violation[] {
	const normalized = file.replace(/\\/g, "/");
	const lines = text.split("\n");
	const violations: Violation[] = [];
	for (const rule of RULES) {
		if (rule.allow?.some((allowed) => normalized.endsWith(allowed))) continue;
		lines.forEach((line, index) => {
			if (rule.pattern.test(line)) {
				violations.push({
					file: normalized,
					line: index + 1,
					rule: rule.name,
					excerpt: line.trim().slice(0, 120),
				});
			}
		});
	}
	return violations;
}

const SCANNED = /\.(astro|ts|mjs|tsx)$/;
const SKIPPED_FILE = /\.test\.[a-z]+$/;

/** Scansiona una cartella: salta test, `checks/` (che contiene gli esempi vietati) e node_modules. */
export function scanDirectory(root: string): Violation[] {
	const violations: Violation[] = [];
	const walk = (directory: string) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isDirectory()) {
				if (entry.name === "node_modules" || entry.name === "checks") continue;
				walk(path);
			} else if (SCANNED.test(entry.name) && !SKIPPED_FILE.test(entry.name)) {
				violations.push(
					...scanSource(relative(root, path), readFileSync(path, "utf8")),
				);
			}
		}
	};
	walk(root);
	return violations;
}
