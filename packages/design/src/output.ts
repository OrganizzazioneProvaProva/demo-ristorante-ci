import type { DesignTokens, TypographyToken } from "./schema.ts";
import { deriveStates } from "./states.ts";

/** Nome della variabile CSS di una famiglia, come la crea la Fonts API di Astro. */
export function fontVariable(family: string): string {
	return `--font-${family.toLowerCase().replace(/\s+/g, "-")}`;
}

const FALLBACKS = {
	sans: "system-ui, sans-serif",
	serif: "Georgia, serif",
} as const;

function fontStack(token: TypographyToken): string {
	return `var(${fontVariable(token.fontFamily)}), ${FALLBACKS[token.fontFallback]}`;
}

/**
 * CSS dei VALORI del design (il livello cliente). I ruoli e le classi stanno nel core
 * (`@siti/core/theme.css`), che legge queste variabili `--t-*`.
 */
export function themeCss(tokens: DesignTokens): string {
	const lines: string[] = [];
	for (const [role, value] of Object.entries(tokens.colors)) {
		lines.push(`--t-${role}: ${value.toLowerCase()};`);
	}
	for (const [state, value] of Object.entries(deriveStates(tokens.colors))) {
		lines.push(`--t-${state}: ${value};`);
	}
	lines.push(`--t-font-display: ${fontStack(tokens.typography.display)};`);
	lines.push(`--t-font-body: ${fontStack(tokens.typography.body)};`);
	lines.push(`--t-weight-display: ${tokens.typography.display.fontWeight};`);
	lines.push(`--t-weight-body: ${tokens.typography.body.fontWeight};`);
	if (tokens.typography.label) {
		lines.push(`--t-weight-label: ${tokens.typography.label.fontWeight};`);
	}
	lines.push(`--t-radius: ${tokens.rounded.ui};`);

	// Il cambio di pagina nativo (`@view-transition`) è un'opt-in del documento e non si può
	// condizionare con un attributo: si scrive qui, solo se il livello di movimento lo prevede.
	const pageTransition =
		tokens.motion === "no-animation"
			? ""
			: "\n@media (prefers-reduced-motion: no-preference) {\n\t@view-transition {\n\t\tnavigation: auto;\n\t}\n}\n";

	return `/* Generato da DESIGN.md ("${tokens.name.replace(/"/g, "'")}"): non modificare a mano. */\n:root {\n\t${lines.join("\n\t")}\n}\n${pageTransition}`;
}

export interface FontConfig<Provider> {
	provider: Provider;
	name: string;
	cssVariable: string;
	weights: number[];
	styles: ["normal"];
	subsets: ["latin"];
}

/** Famiglie e pesi usati dal design, nella forma dell'opzione `fonts` di Astro. */
export function fontsConfig<Provider>(
	tokens: DesignTokens,
	provider: Provider,
): Array<FontConfig<Provider>> {
	const weights = new Map<string, Set<number>>();
	for (const token of Object.values(tokens.typography)) {
		if (!token) continue;
		const set = weights.get(token.fontFamily) ?? new Set<number>();
		set.add(token.fontWeight);
		weights.set(token.fontFamily, set);
	}
	return [...weights.entries()].map(([name, set]) => ({
		provider,
		name,
		cssVariable: fontVariable(name),
		weights: [...set].sort((a, b) => a - b),
		styles: ["normal"],
		subsets: ["latin"],
	}));
}

/** Variabili dei font da dichiarare nell'head con il componente `<Font />` di Astro. */
export function fontVariables(tokens: DesignTokens): string[] {
	return fontsConfig(tokens, null).map((font) => font.cssVariable);
}
