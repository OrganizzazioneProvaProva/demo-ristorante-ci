import {
	localDateTime,
	openingStatus,
	weekdayOf,
} from "../content/opening-status.ts";
import { describeStatus } from "../content/opening-text.ts";

/**
 * Aggiorna "aperto ora" nel browser e segna il giorno di oggi nell'elenco degli orari. Il
 * contenuto essenziale (gli orari della settimana) è già nell'HTML: senza questo script resta
 * leggibile, manca solo la frase dello stato. Dati e testi arrivano dagli attributi `data-*`
 * scritti da `OpeningHours.astro`. Si riaggiorna ogni minuto e quando la scheda torna visibile.
 */
function update(): void {
	const now = new Date();
	const today = localDateTime(now).date;
	for (const element of document.querySelectorAll<HTMLElement>(
		"[data-open-status]",
	)) {
		const hours = JSON.parse(element.dataset.hours ?? "null");
		const labels = JSON.parse(element.dataset.labels ?? "null");
		if (!hours || !labels) continue;
		const status = openingStatus(hours, now);
		element.textContent = describeStatus(status, today, labels);
		element.dataset.state = status.open ? "open" : "closed";

		const section = element.closest("[data-hours-section]");
		if (!section) continue;
		const todayName = weekdayOf(today);
		for (const row of section.querySelectorAll<HTMLElement>("[data-weekday]")) {
			row.toggleAttribute("data-today", row.dataset.weekday === todayName);
		}
		for (const item of section.querySelectorAll<HTMLElement>("[data-to]")) {
			item.hidden = (item.dataset.to ?? "") < today;
		}
	}
}

update();
setInterval(update, 60_000);
document.addEventListener("visibilitychange", () => {
	if (!document.hidden) update();
});
