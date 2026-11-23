/**
 * Contrasto WCAG 2.x tra due colori `#rrggbb`. Soglie di 02 ("Contrasto"): testo normale
 * 4,5:1, testo grande e componenti 3:1.
 */

function channel(value: number): number {
	const c = value / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
	const match = /^#([0-9a-f]{6})$/i.exec(hex);
	if (!match?.[1]) throw new Error(`Colore non valido (serve #rrggbb): ${hex}`);
	const value = Number.parseInt(match[1], 16);
	const r = (value >> 16) & 0xff;
	const g = (value >> 8) & 0xff;
	const b = value & 0xff;
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string): number {
	const a = relativeLuminance(foreground);
	const b = relativeLuminance(background);
	const lighter = Math.max(a, b);
	const darker = Math.min(a, b);
	return (lighter + 0.05) / (darker + 0.05);
}
