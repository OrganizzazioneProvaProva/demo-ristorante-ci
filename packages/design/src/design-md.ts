import { parse as parseYaml } from "yaml";
import { contrastRatio } from "./contrast.ts";
import { type DesignTokens, designTokensSchema } from "./schema.ts";
import { deriveStates } from "./states.ts";

export interface ContrastFinding {
	name: string;
	foreground: string;
	background: string;
	ratio: number;
	minimum: number;
	passes: boolean;
}

/** Coppie dei ruoli che il core usa per il testo (02: testo normale 4,5:1). */
const TEXT_RULES: ReadonlyArray<
	readonly [name: string, foreground: string, background: string]
> = [
	["Testo su sfondo", "ink", "bg"],
	["Testo su superficie", "ink", "surface"],
	["Testo secondario su sfondo", "muted", "bg"],
	["Testo secondario su superficie", "muted", "surface"],
	["Accento come testo su sfondo", "accent", "bg"],
	["Accento come testo su superficie", "accent", "surface"],
	["Testo sul pulsante", "accent-ink", "accent"],
	["Testo sul pulsante (hover)", "accent-ink", "accent-hover"],
	["Testo su evidenza", "pop-ink", "pop"],
];

const MINIMUM_TEXT = 4.5;

function resolveColor(value: string, tokens: DesignTokens): string {
	const reference = /^\{colors\.([a-z-]+)\}$/.exec(value);
	if (!reference?.[1]) return value;
	const resolved = (tokens.colors as Record<string, string>)[reference[1]];
	if (!resolved) throw new Error(`Riferimento sconosciuto: ${value}`);
	return resolved;
}

/** Tutti i controlli di contrasto: le coppie del core più i `components` del file. */
export function checkContrast(tokens: DesignTokens): ContrastFinding[] {
	const base = tokens.colors as Record<string, string>;
	const colors: Record<string, string> = { ...base, ...deriveStates(base) };
	const findings: ContrastFinding[] = TEXT_RULES.map(
		([name, foreground, background]) => {
			const fg = colors[foreground] as string;
			const bg = colors[background] as string;
			const ratio = contrastRatio(fg, bg);
			return {
				name,
				foreground: fg,
				background: bg,
				ratio,
				minimum: MINIMUM_TEXT,
				passes: ratio >= MINIMUM_TEXT,
			};
		},
	);

	for (const [component, definition] of Object.entries(tokens.components)) {
		if (!definition.textColor || !definition.backgroundColor) continue;
		const fg = resolveColor(definition.textColor, tokens);
		const bg = resolveColor(definition.backgroundColor, tokens);
		const ratio = contrastRatio(fg, bg);
		findings.push({
			name: `Componente ${component}`,
			foreground: fg,
			background: bg,
			ratio,
			minimum: MINIMUM_TEXT,
			passes: ratio >= MINIMUM_TEXT,
		});
	}
	return findings;
}

/**
 * Sezioni del formato DESIGN.md (alpha) nell'ordine previsto; gli alias hanno lo stesso
 * posto. Le sezioni sconosciute si conservano senza errore (come dice la specifica).
 */
const SECTION_ORDER: ReadonlyArray<readonly string[]> = [
	["Overview", "Brand & Style"],
	["Colors"],
	["Typography"],
	["Layout", "Layout & Spacing"],
	["Elevation & Depth", "Elevation"],
	["Shapes"],
	["Motion & Micro-interaction", "Motion & Micro-interactions", "Motion"],
	["Voice & Content Strategy"],
	["Components"],
	["Do's and Don'ts"],
];

function sectionProblems(headings: readonly string[]): string[] {
	const problems: string[] = [];
	const seen = new Set<string>();
	let lastRank = -1;
	for (const heading of headings) {
		if (seen.has(heading)) problems.push(`sezione duplicata: "${heading}"`);
		seen.add(heading);
		const rank = SECTION_ORDER.findIndex((names) => names.includes(heading));
		if (rank === -1) continue;
		if (rank < lastRank) {
			problems.push(`sezione fuori ordine: "${heading}"`);
		}
		lastRank = Math.max(lastRank, rank);
	}
	return problems;
}

export interface ParsedDesign {
	tokens: DesignTokens;
	findings: ContrastFinding[];
	/** Titoli `##` del corpo, nell'ordine in cui compaiono. */
	sections: string[];
}

/**
 * Legge un DESIGN.md: front matter YAML con i token, poi la prosa. Se qualcosa non va
 * (schema, ordine delle sezioni, contrasto) lancia un errore che le elenca TUTTE: nel
 * build fa fallire il sito invece di pubblicare colori illeggibili.
 */
export function parseDesignMd(source: string): ParsedDesign {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
	if (!match) {
		throw new Error(
			"DESIGN.md: manca il front matter YAML tra due righe `---`.",
		);
	}

	let raw: unknown;
	try {
		raw = parseYaml(match[1] ?? "", { uniqueKeys: true });
	} catch (error) {
		throw new Error(
			`DESIGN.md: YAML non valido (${error instanceof Error ? error.message : error}).`,
		);
	}

	const problems: string[] = [];
	const result = designTokensSchema.safeParse(raw);
	if (!result.success) {
		for (const issue of result.error.issues) {
			problems.push(`${issue.path.join(".") || "(radice)"}: ${issue.message}`);
		}
	}

	const sections = [...(match[2] ?? "").matchAll(/^## (.+?)\s*$/gm)].map(
		(m) => m[1] as string,
	);
	problems.push(...sectionProblems(sections));

	if (!result.success) {
		throw new Error(`DESIGN.md non valido:\n- ${problems.join("\n- ")}`);
	}

	const findings = checkContrast(result.data);
	for (const finding of findings.filter((f) => !f.passes)) {
		problems.push(
			`contrasto insufficiente — ${finding.name}: ${finding.foreground} su ${finding.background} = ${finding.ratio.toFixed(2)}:1 (minimo ${finding.minimum}:1)`,
		);
	}
	if (problems.length > 0) {
		throw new Error(`DESIGN.md non valido:\n- ${problems.join("\n- ")}`);
	}

	return { tokens: result.data, findings, sections };
}
