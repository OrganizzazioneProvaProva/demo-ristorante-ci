import { contrastRatio } from "./contrast.ts";
import { mixHex } from "./states.ts";

/**
 * Velo dell'hero a tutto schermo (`Hero variant="cover"`): una miscela del colore del testo (`ink`)
 * sopra la foto, perché il titolo (colore `bg`) si legga su qualunque foto. Percentuale di `ink`
 * nel velo; deve coincidere con quella scritta nelle classi di `Hero.astro` (lo verifica un test).
 */
export const HERO_SCRIM_PERCENT = 70;

/** Contrasto minimo del testo normale (WCAG 2.2 AA). */
export const HERO_MIN_CONTRAST = 4.5;

/**
 * Contrasto nel caso peggiore del titolo sul velo: si prova una foto tutta bianca e una tutta nera
 * (con una palette dal testo chiaro il caso peggiore è la foto nera, con una dal testo scuro
 * quella bianca). Una foto vera sta tra i due.
 */
export function heroScrimContrast(colors: { ink: string; bg: string }): {
	onWhite: number;
	onBlack: number;
	worst: number;
} {
	const weight = HERO_SCRIM_PERCENT / 100;
	// Il velo ha `ink` al `weight` e la foto al resto: si mescola `ink` con il colore della foto.
	const onWhite = contrastRatio(
		colors.bg,
		mixHex("#ffffff", colors.ink, weight),
	);
	const onBlack = contrastRatio(
		colors.bg,
		mixHex("#000000", colors.ink, weight),
	);
	return { onWhite, onBlack, worst: Math.min(onWhite, onBlack) };
}
