/**
 * Viste di un catalogo con più gruppi (per esempio i menu «Pizzeria» e «Ristorante»): con
 * JavaScript se ne vede uno alla volta. Il contenuto resta tutto nell'HTML: senza JavaScript i
 * pulsanti sono link a un'ancora e si vede ogni gruppo.
 *
 * Le viste nascondono con `data-view-inactive` (una regola CSS del core), mai con `hidden`: la
 * ricerca (`catalog-search.ts`) usa `hidden` sugli stessi elementi, così i due effetti si sommano
 * e non si disfano a vicenda. Durante una ricerca (evento `catalog-search`) si vedono tutti i
 * gruppi, perché i risultati valgono per l'intero catalogo; svuotata la ricerca, torna la vista
 * scelta. Un'ancora che punta dentro un gruppo (`#dolci`) lo apre, anche con `hashchange`.
 */
/* Lo carica `CatalogSearch.astro` insieme alla ricerca: un solo file per il catalogo. */
function init(root: HTMLElement): void {
	const buttons = [
		...root.querySelectorAll<HTMLAnchorElement>("[data-view-button]"),
	];
	const panels = [...root.querySelectorAll<HTMLElement>("[data-view-panel]")];
	const first = panels[0];
	if (!first || panels.length < 2) return;

	let active = first.id;
	let searching = false;

	const render = (): void => {
		for (const panel of panels) {
			panel.toggleAttribute(
				"data-view-inactive",
				!searching && panel.id !== active,
			);
		}
		for (const button of buttons) {
			const current = button.getAttribute("href") === `#${active}`;
			if (current) button.setAttribute("aria-current", "true");
			else button.removeAttribute("aria-current");
		}
	};

	const fromHash = (): void => {
		const id = decodeURIComponent(location.hash.slice(1));
		if (!id) return;
		const target = document.getElementById(id);
		const panel = target
			? panels.find((candidate) => candidate.contains(target))
			: undefined;
		if (!panel) return;
		active = panel.id;
		render();
		if (target && target !== panel) target.scrollIntoView();
	};

	for (const button of buttons) {
		button.addEventListener("click", (event) => {
			const id = button.getAttribute("href")?.slice(1);
			if (!id || !panels.some((panel) => panel.id === id)) return;
			event.preventDefault();
			active = id;
			render();
			history.replaceState(null, "", `#${id}`);
		});
	}
	document.addEventListener("catalog-search", (event) => {
		searching = (event as CustomEvent<{ active: boolean }>).detail.active;
		render();
	});
	window.addEventListener("hashchange", fromHash);

	render();
	fromHash();
}

for (const root of document.querySelectorAll<HTMLElement>(
	"[data-catalog-views]",
)) {
	init(root);
}

// Un modulo (non uno script globale): le funzioni `init` degli script non devono scontrarsi.
export {};
