import { addDays } from "./holidays.ts";
import type { HoursLabels } from "./opening-labels.ts";
import { type OpenStatus, weekdayOf } from "./opening-status.ts";

/**
 * La frase dello stato ("Aperto ora · chiude alle 15:00", "Chiuso ora · riapre domani alle
 * 19:00"). Pura e senza dipendenze da zod: la usa lo script del browser. `today` è la data
 * locale AAAA-MM-GG, per dire "domani" o il nome del giorno.
 */
export function describeStatus(
	status: OpenStatus,
	today: string,
	labels: HoursLabels,
): string {
	if (status.open) {
		return labels.openUntil.replace("{time}", status.closesAt ?? "");
	}
	const closed =
		status.reason === "regular" ? labels.closedNow : labels.closedToday;
	const next = status.nextOpening;
	if (!next) return closed;
	let when: string;
	if (next.date === today) {
		when = labels.reopensToday.replace("{time}", next.opens);
	} else if (next.date === addDays(today, 1)) {
		when = labels.reopensTomorrow.replace("{time}", next.opens);
	} else {
		when = labels.reopensOn
			.replace("{day}", labels.weekdaysInSentence[weekdayOf(next.date)])
			.replace("{time}", next.opens);
	}
	return `${closed} · ${when}`;
}
