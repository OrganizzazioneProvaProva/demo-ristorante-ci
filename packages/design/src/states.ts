import { relativeLuminance } from "./contrast.ts";

/**
 * Stati derivati dai ruoli (hover). Sono colori OPACHI calcolati dai valori del DESIGN.md,
 * non trasparenze: così la pipeline dei contrasti li controlla come ogni altra coppia
 * (le classi con opacità sui ruoli, `bg-accent/80`, sono vietate nei componenti perché
 * il contrasto reale cambia con lo sfondo e nessun controllo lo vede).
 */

/** Quanto lo stato si sposta verso il colore di arrivo (0-1). */
export const HOVER_SHIFT = 0.15;

function channels(hex: string): [number, number, number] {
	const match = /^#([0-9a-f]{6})$/i.exec(hex);
	if (!match?.[1]) throw new Error(`Colore non valido (serve #rrggbb): ${hex}`);
	const value = Number.parseInt(match[1], 16);
	return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** Miscela in sRGB: `weight` è la quota di `to` (0 = `from`, 1 = `to`, fuori da 0-1 è un errore). */
export function mixHex(from: string, to: string, weight: number): string {
	if (!(weight >= 0 && weight <= 1)) {
		throw new RangeError(`weight deve stare tra 0 e 1 (ricevuto ${weight})`);
	}
	const a = channels(from);
	const b = channels(to);
	const mixed = a.map((value, index) =>
		Math.round(value + ((b[index] as number) - value) * weight),
	);
	return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Hover del pulsante: si sposta nella direzione che AUMENTA il contrasto con il testo, anche
 * nelle palette scure (non si presume che `ink` sia scuro e `surface` chiaro).
 * - Testo più chiaro dell'accento: l'accento si scurisce verso il più scuro tra `ink` e
 *   `surface` (se nessuno dei due è più scuro dell'accento, verso nero).
 * - Testo più scuro dell'accento: si schiarisce verso il più chiaro dei due (altrimenti
 *   verso bianco).
 */
export function deriveStates(colors: Record<string, string>): {
	"accent-hover": string;
} {
	const accent = colors.accent as string;
	const accentInk = colors["accent-ink"] as string;
	const accentLuminance = relativeLuminance(accent);
	const candidates = [colors.ink as string, colors.surface as string];
	const byLuminance = [...candidates].sort(
		(a, b) => relativeLuminance(a) - relativeLuminance(b),
	);
	const darkest = byLuminance[0] as string;
	const lightest = byLuminance[1] as string;

	let target: string;
	if (relativeLuminance(accentInk) > accentLuminance) {
		target = relativeLuminance(darkest) < accentLuminance ? darkest : "#000000";
	} else {
		target =
			relativeLuminance(lightest) > accentLuminance ? lightest : "#ffffff";
	}
	return { "accent-hover": mixHex(accent, target, HOVER_SHIFT) };
}
