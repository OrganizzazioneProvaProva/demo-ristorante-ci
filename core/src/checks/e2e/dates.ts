import type { Browser } from "playwright-core";
import { addDays } from "../../content/holidays.ts";
import {
	localDateTime,
	openingStatus,
	weekdayOf,
} from "../../content/opening-status.ts";
import { describeStatus } from "../../content/opening-text.ts";

/** Istanti di prova (UTC) per "aperto ora": martedì a pranzo, tra pranzo e cena, lunedì, sera tardi. */
const STATUS_INSTANTS: Array<{ instant: string; timezoneId?: string }> = [
	{ instant: "2026-12-01T12:00:00Z" },
	{ instant: "2026-12-01T15:30:00Z" },
	{ instant: "2026-11-30T11:00:00Z" },
	{ instant: "2026-12-01T22:30:00Z" },
	// estate (ora legale, UTC+2): martedì 14 luglio, 12:00 a Roma
	{ instant: "2026-07-14T10:00:00Z" },
	// il visitatore è a New York: lo stato segue comunque Europe/Rome
	{ instant: "2026-12-01T12:00:00Z", timezoneId: "America/New_York" },
];

/**
 * "Aperto ora": con l'orologio del browser fissato, la frase mostrata e il giorno di oggi
 * devono essere quelli calcolati da Node sugli stessi dati; senza JavaScript gli orari della
 * settimana (7 righe) restano leggibili.
 */
export async function checkOpenStatus(
	browser: Browser,
	url: string,
	path: string,
	label: string,
	failures: string[],
): Promise<void> {
	const probe = await browser.newContext({
		viewport: { width: 390, height: 844 },
	});
	const probePage = await probe.newPage();
	await probePage.goto(url + path, { waitUntil: "load" });
	const present = (await probePage.locator("[data-open-status]").count()) > 0;
	// la chiusura più vicina scritta nell'HTML: un istante il giorno dopo la sua fine
	const closureEnds = await probePage.evaluate(() =>
		[...document.querySelectorAll("[data-to]")].map(
			(item) => (item as HTMLElement).dataset.to ?? "",
		),
	);
	await probe.close();
	if (!present) return;
	const instants = [...STATUS_INSTANTS];
	const earliestEnd = closureEnds.filter(Boolean).sort()[0];
	if (earliestEnd) {
		instants.push({ instant: `${addDays(earliestEnd, 1)}T10:00:00Z` });
	}

	for (const { instant, timezoneId } of instants) {
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			...(timezoneId ? { timezoneId } : {}),
		});
		const page = await context.newPage();
		await page.clock.install({ time: new Date(instant) });
		await page.goto(url + path, { waitUntil: "load" });
		await page.waitForTimeout(200);
		const found = await page.evaluate(() => {
			const element = document.querySelector<HTMLElement>("[data-open-status]");
			return {
				text: element?.textContent ?? "",
				hours: element?.dataset.hours ?? "null",
				labels: element?.dataset.labels ?? "null",
				today: [...document.querySelectorAll("[data-weekday][data-today]")].map(
					(row) => (row as HTMLElement).dataset.weekday,
				),
				visibleClosures: [...document.querySelectorAll("[data-to]")]
					.filter((item) => !(item as HTMLElement).hidden)
					.map((item) => (item as HTMLElement).dataset.to),
			};
		});
		const now = new Date(instant);
		const date = localDateTime(now).date;
		const expected = describeStatus(
			openingStatus(JSON.parse(found.hours), now),
			date,
			JSON.parse(found.labels),
		);
		if (found.text !== expected) {
			failures.push(
				`${label}: alle ${instant} "aperto ora" mostra «${found.text}», atteso «${expected}»`,
			);
		}
		if (found.today.length !== 1 || found.today[0] !== weekdayOf(date)) {
			failures.push(
				`${label}: alle ${instant} il giorno di oggi è ${JSON.stringify(found.today)}, atteso ${weekdayOf(date)}`,
			);
		}
		const expired = found.visibleClosures.filter((to) => (to ?? "") < date);
		if (expired.length > 0) {
			failures.push(
				`${label}: alle ${instant} restano visibili chiusure già finite (${expired.join(", ")})`,
			);
		}
		await context.close();
	}

	// L'aggiornamento ogni minuto: 30 secondi prima di un cambio di stato, poi si avanza di 90 secondi
	{
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
		});
		const page = await context.newPage();
		const start = new Date("2026-12-01T13:59:30Z");
		await page.clock.install({ time: start });
		await page.goto(url + path, { waitUntil: "load" });
		await page.waitForTimeout(200);
		await page.clock.fastForward(90_000);
		await page.waitForTimeout(200);
		const after = await page.evaluate(() => {
			const element = document.querySelector<HTMLElement>("[data-open-status]");
			return {
				text: element?.textContent ?? "",
				hours: element?.dataset.hours ?? "null",
				labels: element?.dataset.labels ?? "null",
			};
		});
		const later = new Date(start.getTime() + 90_000);
		const expectedAfter = describeStatus(
			openingStatus(JSON.parse(after.hours), later),
			localDateTime(later).date,
			JSON.parse(after.labels),
		);
		if (after.text !== expectedAfter) {
			failures.push(
				`${label}: dopo 90 secondi lo stato mostra «${after.text}», atteso «${expectedAfter}» (aggiornamento ogni minuto)`,
			);
		}
		await context.close();
	}

	const noJs = await browser.newContext({
		viewport: { width: 390, height: 844 },
		javaScriptEnabled: false,
	});
	const noJsPage = await noJs.newPage();
	await noJsPage.goto(url + path, { waitUntil: "load" });
	const rows = await noJsPage.locator("[data-weekday]").count();
	if (rows !== 7)
		failures.push(
			`${label}: senza JavaScript gli orari mostrano ${rows} giorni invece di 7`,
		);
	await noJs.close();
}

/**
 * Avvisi e promozioni con date di validità (`data-valid-from` / `data-valid-to`): con l'orologio
 * del browser dopo la scadenza il browser li nasconde (e nasconde il contenitore se sono tutti
 * scaduti); senza JavaScript restano visibili come alla build.
 */
export async function checkValidDates(
	browser: Browser,
	url: string,
	path: string,
	label: string,
	failures: string[],
): Promise<void> {
	const probe = await browser.newContext({
		viewport: { width: 390, height: 844 },
	});
	const probePage = await probe.newPage();
	await probePage.goto(url + path, { waitUntil: "load" });
	const ends = await probePage.evaluate(() =>
		[...document.querySelectorAll("[data-valid-to]")].map(
			(item) => (item as HTMLElement).dataset.validTo ?? "",
		),
	);
	await probe.close();
	const sorted = ends.filter(Boolean).sort();
	if (sorted.length === 0) return;

	const instants = [
		`${addDays(sorted[0] as string, 1)}T10:00:00Z`,
		`${addDays(sorted[sorted.length - 1] as string, 1)}T10:00:00Z`,
	];
	for (const instant of instants) {
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
		});
		const page = await context.newPage();
		await page.clock.install({ time: new Date(instant) });
		await page.goto(url + path, { waitUntil: "load" });
		await page.waitForTimeout(200);
		const date = localDateTime(new Date(instant)).date;
		const state = await page.evaluate(() => ({
			items: [
				...document.querySelectorAll("[data-valid-from], [data-valid-to]"),
			].map((item) => ({
				to: (item as HTMLElement).dataset.validTo ?? "",
				from: (item as HTMLElement).dataset.validFrom ?? "",
				hidden: (item as HTMLElement).hidden,
			})),
			groups: [...document.querySelectorAll("[data-valid-group]")].map(
				(group) => ({
					hidden: (group as HTMLElement).hidden,
					allItemsHidden: [
						...group.querySelectorAll("[data-valid-from], [data-valid-to]"),
					].every((item) => (item as HTMLElement).hidden),
				}),
			),
		}));
		for (const item of state.items) {
			const expired =
				(item.to && date > item.to) || (item.from && date < item.from);
			if (Boolean(expired) !== item.hidden) {
				failures.push(
					`${label}: alle ${instant} un elemento valido ${item.from || "…"}–${item.to || "…"} è ${item.hidden ? "nascosto" : "visibile"} (atteso ${expired ? "nascosto" : "visibile"})`,
				);
			}
		}
		for (const group of state.groups) {
			if (group.allItemsHidden !== group.hidden) {
				failures.push(
					`${label}: alle ${instant} un gruppo con tutti gli elementi scaduti non sparisce (o sparisce senza motivo)`,
				);
			}
		}
		await context.close();
	}

	const noJs = await browser.newContext({
		viewport: { width: 390, height: 844 },
		javaScriptEnabled: false,
	});
	const noJsPage = await noJs.newPage();
	await noJsPage.goto(url + path, { waitUntil: "load" });
	const hiddenWithoutJs = await noJsPage.evaluate(
		() =>
			[
				...document.querySelectorAll("[data-valid-from], [data-valid-to]"),
			].filter((i) => (i as HTMLElement).hidden).length,
	);
	if (hiddenWithoutJs > 0)
		failures.push(
			`${label}: senza JavaScript ${hiddenWithoutJs} elementi con date risultano nascosti`,
		);
	await noJs.close();
}
