import { companyEmailContact } from "@siti/config";
import type { CompanyInfo } from "./company.ts";
import type { OpeningHours, Weekday } from "./opening-hours.ts";
import { WEEKDAYS } from "./opening-hours.ts";
import { telHref } from "./shell.ts";

// I separatori di riga Unicode si costruiscono dal codice: un formattatore può trasformare
// l'escape in un carattere vero, che in un'espressione regolare scritta a mano rompe il file.
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), "g");
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), "g");

/**
 * Dati strutturati (JSON-LD) di schema.org. Il testo finisce dentro `<script
 * type="application/ld+json">` con HTML grezzo, l'UNICO punto del sito dove il codice grezzo è
 * ammesso (`04` §3): per questo il JSON esce con l'escape di `<`, `>`, `&` e dei separatori di
 * riga Unicode, così nessun testo dei dati (un nome con `</script>`) può chiudere il tag o
 * iniettare codice. Il risultato resta JSON valido con gli stessi valori.
 */
export function serializeJsonLd(data: unknown): string {
	return JSON.stringify(data)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/&/g, "\\u0026")
		.replace(LINE_SEPARATOR, "\\u2028")
		.replace(PARAGRAPH_SEPARATOR, "\\u2029");
}

const DAY_OF_WEEK: Record<Weekday, string> = {
	monday: "https://schema.org/Monday",
	tuesday: "https://schema.org/Tuesday",
	wednesday: "https://schema.org/Wednesday",
	thursday: "https://schema.org/Thursday",
	friday: "https://schema.org/Friday",
	saturday: "https://schema.org/Saturday",
	sunday: "https://schema.org/Sunday",
};

/**
 * Orari per schema.org (formato accettato da Google): una voce per ogni fascia, con i giorni che
 * hanno la stessa fascia raggruppati; i giorni di chiusura non hanno voci; una chiusura
 * straordinaria non ancora finita (`to >= today`) è una voce con `opens` e `closes` a 00:00 e il
 * periodo in `validFrom` / `validThrough`. Le festività scelte dal titolare e il patrono non sono
 * qui: cambiano data ogni anno e il testo degli orari resta quello della settimana.
 */
export function openingHoursSpecification(
	hours: OpeningHours,
	today: string,
): Array<Record<string, unknown>> {
	const byInterval = new Map<
		string,
		{ opens: string; closes: string; days: Weekday[] }
	>();
	for (const day of WEEKDAYS) {
		const entry = hours[day];
		if (entry.closed) continue;
		for (const interval of entry.intervals ?? []) {
			const key = `${interval.opens}-${interval.closes}`;
			const found = byInterval.get(key);
			if (found) found.days.push(day);
			else byInterval.set(key, { ...interval, days: [day] });
		}
	}
	const specs: Array<Record<string, unknown>> = [...byInterval.values()].map(
		(group) => ({
			"@type": "OpeningHoursSpecification",
			dayOfWeek: group.days.map((day) => DAY_OF_WEEK[day]),
			opens: group.opens,
			closes: group.closes,
		}),
	);
	for (const closure of hours.closures ?? []) {
		if (closure.to < today) continue;
		specs.push({
			"@type": "OpeningHoursSpecification",
			dayOfWeek: WEEKDAYS.map((day) => DAY_OF_WEEK[day]),
			opens: "00:00",
			closes: "00:00",
			validFrom: closure.from,
			validThrough: closure.to,
		});
	}
	return specs;
}

const COORDINATES = /^(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)$/;

/** `"37.3856,14.3708"` → coordinate; un valore diverso ferma la build. */
export function parseCoordinates(text: string): {
	latitude: number;
	longitude: number;
} {
	const match = COORDINATES.exec(text);
	if (!match) {
		throw new Error(
			`Coordinate non valide (serve "lat,lng", per esempio "37.38,14.37"): ${text}. La build si ferma.`,
		);
	}
	const latitude = Number(match[1]);
	const longitude = Number(match[2]);
	if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
		throw new Error(`Coordinate fuori intervallo: ${text}. La build si ferma.`);
	}
	return { latitude, longitude };
}

export interface LocalBusinessInput {
	/** Tipo schema.org (`Restaurant`, `HairSalon`…): lo sceglie il preset della nicchia. */
	type: string;
	company: CompanyInfo;
	/** Indirizzo assoluto della pagina (con barra finale), nella lingua della pagina. */
	url: string;
	/**
	 * Indirizzo della home nella lingua PRINCIPALE: dà l'`@id`, uguale in ogni lingua, così il
	 * locale è un'entità sola anche se ha una pagina per lingua. Senza, si usa `url`.
	 */
	idUrl?: string;
	hours?: OpeningHours;
	/** Oggi alla build (AAAA-MM-GG): le chiusure già finite non si scrivono. */
	today: string;
	/** Punto preciso "lat,lng", se il sito lo ha (oggi una costante del sito, non un campo dello Studio). */
	geo?: string;
	/** Proprietà del sottotipo (cucina, menu…): le aggiunge il preset, solo se i dati esistono. */
	extra?: Record<string, unknown>;
}

/**
 * Attività locale per schema.org. Si scrive SOLO ciò che i dati dicono: niente valori inventati
 * (prezzi, immagini, voti). Non si scrive `aggregateRating`: secondo le linee guida di Google le
 * recensioni di un'attività sul proprio sito non danno stelle nei risultati e non si possono
 * aggregare recensioni di altri siti (https://developers.google.com/search/docs/appearance/structured-data/review-snippet,
 * https://developers.google.com/search/blog/2019/09/making-review-rich-results-more-helpful).
 * La valutazione su Google che si vede nella pagina (prova sociale) resta quindi senza dati strutturati.
 */
export function localBusinessJsonLd(
	input: LocalBusinessInput,
): Record<string, unknown> {
	const { company, hours, today } = input;
	const telephone = company.phone
		? telHref(company.phone)?.replace(/^tel:/, "")
		: undefined;
	const email = companyEmailContact(company.email)?.first;
	const geo = input.geo ? parseCoordinates(input.geo) : undefined;
	const specs = hours ? openingHoursSpecification(hours, today) : [];
	return {
		"@context": "https://schema.org",
		"@type": input.type,
		"@id": `${input.idUrl ?? input.url}#business`,
		name: company.name,
		url: input.url,
		...(telephone ? { telephone } : {}),
		...(email ? { email } : {}),
		vatID: `IT${company.vatNumber}`,
		address: {
			"@type": "PostalAddress",
			streetAddress: company.address.street,
			postalCode: company.address.postalCode,
			addressLocality: company.address.city,
			addressRegion: company.address.province,
			addressCountry: "IT",
		},
		...(geo ? { geo: { "@type": "GeoCoordinates", ...geo } } : {}),
		...(specs.length > 0 ? { openingHoursSpecification: specs } : {}),
		...(input.extra ?? {}),
	};
}
