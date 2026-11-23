/**
 * Spazio riservato alla barra di azioni fissa in basso (solo telefono, sotto `md`): 5 rem
 * (la barra è alta circa 4 rem) più la safe area dei telefoni con la barra di sistema.
 * - il padding in fondo alla pagina evita che il piè di pagina resti sotto la barra;
 * - lo `scroll-padding` evita che un elemento che riceve il focus da tastiera finisca sotto
 *   la barra (WCAG 2.4.11, Focus Not Obscured).
 * Vanno applicati solo quando la barra c'è.
 */
export const BAR_CLEARANCE_PADDING =
	"pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0";
export const BAR_CLEARANCE_SCROLL =
	"scroll-pb-[calc(5rem+env(safe-area-inset-bottom))] md:scroll-pb-0";

/**
 * `scroll-padding-top` di `<html>`: l'intestazione è fissa in alto (sticky) e a volte copre la
 * cima della finestra; senza, un link interno (`#storia`) o un elemento che riceve il focus
 * finirebbe sotto di essa (WCAG 2.4.11). 5 rem coprono l'intestazione (circa 4,3 rem).
 */
export const HEADER_SCROLL_PADDING = "scroll-pt-20";
