/**
 * Stato dell'intestazione del telefono rispetto allo scroll: si nasconde scorrendo in basso e
 * ricompare risalendo. Funzione pura (la usa il modulo `scripts/header-scroll.ts`, qui si prova).
 * `anchor` è il punto da cui si misura lo spostamento nella direzione corrente: l'estremo
 * raggiunto prima dell'ultima inversione.
 */
export interface HeaderScrollState {
	hidden: boolean;
	anchor: number;
}

export interface HeaderScrollLimits {
	/** Scroll massimo (`scrollHeight - innerHeight`): il rimbalzo di iOS non inverte la direzione. */
	maxY: number;
	/** Sotto questa altezza di scroll l'intestazione è sempre visibile. */
	headerHeight: number;
	/** Spostamento minimo (px) perché una direzione conti. */
	threshold?: number;
}

export const SCROLL_THRESHOLD = 8;

export function nextHeaderScrollState(
	state: HeaderScrollState,
	scrollY: number,
	{ maxY, headerHeight, threshold = SCROLL_THRESHOLD }: HeaderScrollLimits,
): HeaderScrollState {
	const y = Math.min(Math.max(scrollY, 0), Math.max(maxY, 0));
	if (y <= headerHeight) return { hidden: false, anchor: y };

	if (!state.hidden) {
		if (y - state.anchor > threshold) return { hidden: true, anchor: y };
		return { hidden: false, anchor: Math.min(state.anchor, y) };
	}
	if (state.anchor - y > threshold) return { hidden: false, anchor: y };
	return { hidden: true, anchor: Math.max(state.anchor, y) };
}
