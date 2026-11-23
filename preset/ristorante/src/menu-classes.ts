/**
 * Classi della sezione del menu. Stanno in un modulo perché il controllo del CSS del sito
 * (`probe.ts`) importa le stesse costanti del componente: se `preset.css` non arriva nel sito,
 * il controllo fallisce. Solo ruoli del design system (mai colori scritti a mano).
 */
export const MENU_CLASSES = {
	root: "mx-auto max-w-5xl px-4 py-8",
	groupTitle: "font-display text-3xl font-bold text-ink",
	sectionTitle: "font-display text-2xl font-bold text-ink",
	itemList: "mt-4 divide-y divide-line",
	itemName: "font-display text-lg font-bold text-ink",
	price: "shrink-0 font-semibold text-ink",
	featured:
		"ml-2 rounded-ui bg-pop px-2 py-0.5 align-middle text-sm font-normal text-pop-ink",
	meta: "mt-2 text-sm text-muted",
	/** Pulsante della vista scelta: pieno, come il pulsante principale. */
	viewButton:
		"aria-[current=true]:border-accent aria-[current=true]:bg-accent aria-[current=true]:text-accent-ink aria-[current=true]:hover:bg-accent-hover",
	anchorLink: "text-ink underline underline-offset-4",
} as const;
