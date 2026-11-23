import { localDateTime } from "../content/opening-status.ts";

/**
 * Nasconde nel browser avvisi e promozioni che non sono (più) validi oggi, senza ricostruire il
 * sito: alla build si scrive ciò che è valido quel giorno, ma una promozione può scadere prima
 * della prossima pubblicazione. Il contenuto resta nell'HTML (senza JavaScript si vede com'era
 * alla build). Date `data-valid-from` / `data-valid-to` (AAAA-MM-GG, giorni compresi), giorno di
 * Roma. Un contenitore `data-valid-group` sparisce quando tutti i suoi elementi sono nascosti.
 */
function update(): void {
	const today = localDateTime(new Date()).date;
	for (const element of document.querySelectorAll<HTMLElement>(
		"[data-valid-from], [data-valid-to]",
	)) {
		const from = element.dataset.validFrom;
		const to = element.dataset.validTo;
		element.hidden = Boolean((from && today < from) || (to && today > to));
	}
	for (const group of document.querySelectorAll<HTMLElement>(
		"[data-valid-group]",
	)) {
		const items = group.querySelectorAll<HTMLElement>(
			"[data-valid-from], [data-valid-to]",
		);
		group.hidden = items.length > 0 && [...items].every((item) => item.hidden);
	}
}

update();
document.addEventListener("visibilitychange", () => {
	if (!document.hidden) update();
});
setInterval(update, 60_000);
