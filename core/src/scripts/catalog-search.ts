import { matchesAll, resultsText } from "../content/search.ts";

/**
 * Filtro del catalogo nella pagina. Il contenuto resta tutto nell'HTML: senza JavaScript la
 * casella è nascosta e il catalogo si vede per intero. Con JavaScript si mostra la casella e si
 * nascondono (`hidden`) gli elementi `[data-search]` che non corrispondono. Un gruppo
 * `[data-search-group]` sparisce quando non ha elementi visibili. Il numero di risultati va
 * nell'area di stato (`role="status"`, WCAG 4.1.3).
 */
function init(box: HTMLElement): void {
	const target = document.getElementById(box.dataset.target ?? "");
	const input = box.querySelector<HTMLInputElement>("input");
	const status = box.querySelector<HTMLElement>("[data-search-status]");
	if (!target || !input || !status) return;
	const labels = {
		resultsMany: box.dataset.many ?? "",
		resultsOne: box.dataset.one ?? "",
		resultsNone: box.dataset.none ?? "",
	};
	const items = [...target.querySelectorAll<HTMLElement>("[data-search]")];
	const groups = [
		...target.querySelectorAll<HTMLElement>("[data-search-group]"),
	];

	const update = (): void => {
		const query = input.value;
		let visible = 0;
		for (const item of items) {
			const show = matchesAll(item.dataset.search ?? "", query);
			item.hidden = !show;
			if (show) visible++;
		}
		for (const group of groups) {
			group.hidden = !group.querySelector("[data-search]:not([hidden])");
		}
		status.textContent =
			query.trim() === "" ? "" : resultsText(visible, labels);
		// Avvisa le viste del catalogo: durante una ricerca si vedono tutti i gruppi.
		document.dispatchEvent(
			new CustomEvent("catalog-search", {
				detail: { active: query.trim() !== "" },
			}),
		);
	};

	input.addEventListener("input", update);
	box.hidden = false;
}

for (const box of document.querySelectorAll<HTMLElement>(
	"[data-catalog-search]",
)) {
	init(box);
}
