/**
 * Classi del pulsante del core. Stanno in un modulo (non nel componente) perché il controllo
 * del CSS dei siti (`checks/check-site.ts`) importa questa stessa costante: se Tailwind non
 * vede le classi del core, il controllo fallisce.
 *
 * Solo ruoli del design system (`bg-accent`, `text-accent-ink`…), mai colori scritti a mano.
 * Niente opacità sui ruoli (`/80`): lo stato hover è `accent-hover`, un colore derivato e
 * controllato nei contrasti. Nessun modo di togliere l'anello di focus: lo dà `theme.css`.
 */
export type ButtonVariant = "primary" | "secondary";

export const BUTTON_BASE =
	"inline-flex min-h-11 items-center justify-center rounded-ui px-5 py-3 font-body font-semibold transition-colors";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
	primary: "bg-accent text-accent-ink hover:bg-accent-hover",
	secondary: "border-2 border-ink text-ink hover:bg-surface",
};

export function buttonClasses(variant: ButtonVariant = "primary"): string {
	return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]}`;
}
