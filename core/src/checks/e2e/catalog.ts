import type { Browser } from "playwright-core";

/**
 * Ricerca nel catalogo (`CatalogSearch`): con JavaScript la casella compare e il filtro nasconde
 * gli elementi che non corrispondono (e i gruppi rimasti vuoti), con il conteggio nell'area di
 * stato; svuotata, torna tutto. Senza JavaScript la casella è nascosta e il catalogo è intero.
 */
export async function checkCatalogSearch(
	browser: Browser,
	url: string,
	path: string,
	label: string,
	failures: string[],
): Promise<void> {
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
	});
	const page = await context.newPage();
	await page.goto(url + path, { waitUntil: "load" });
	if ((await page.locator("[data-catalog-search]").count()) === 0) {
		await context.close();
		return;
	}
	const box = page.locator("[data-catalog-search]").first();
	const input = box.locator("input");
	if (!(await box.isVisible())) {
		failures.push(`${label}: con JavaScript la casella di ricerca non si vede`);
		await context.close();
		return;
	}
	const state = () =>
		page.evaluate(() => {
			const items = [
				...document.querySelectorAll<HTMLElement>("[data-search]"),
			];
			return {
				total: items.length,
				visible: items.filter((item) => !item.hidden).length,
				emptyGroupsVisible: [
					...document.querySelectorAll<HTMLElement>("[data-search-group]"),
				].filter(
					(group) =>
						!group.hidden &&
						!group.querySelector("[data-search]:not([hidden])"),
				).length,
				status:
					document.querySelector("[data-search-status]")?.textContent ?? "",
			};
		});
	const first = await page.evaluate(() => {
		const item = document.querySelector<HTMLElement>("[data-search]");
		return (item?.dataset.search ?? "").split(" ").find((w) => w.length >= 4);
	});
	const all = await state();
	if (all.total < 2 || !first) {
		failures.push(`${label}: il catalogo ha meno di 2 elementi cercabili`);
		await context.close();
		return;
	}
	await input.fill(first);
	const found = await state();
	if (found.visible < 1 || found.visible > all.total) {
		failures.push(`${label}: cercando "${first}" i risultati non tornano`);
	}
	if (
		found.status.trim() === "" ||
		(!found.status.includes(String(found.visible)) &&
			found.visible !== 1 &&
			found.visible !== 0)
	) {
		failures.push(
			`${label}: il conteggio dei risultati non è annunciato ("${found.status}")`,
		);
	}
	if (found.emptyGroupsVisible > 0) {
		failures.push(`${label}: restano visibili gruppi senza risultati`);
	}
	await input.fill("zzzzqqqq");
	const none = await state();
	if (none.visible !== 0 || none.status.trim() === "") {
		failures.push(
			`${label}: senza corrispondenze tutto va nascosto e va annunciato`,
		);
	}
	if (none.emptyGroupsVisible > 0) {
		failures.push(`${label}: senza risultati restano visibili dei gruppi`);
	}
	await input.fill("");
	const cleared = await state();
	if (cleared.visible !== all.total || cleared.status !== "") {
		failures.push(
			`${label}: svuotando la ricerca il catalogo non torna intero`,
		);
	}
	await context.close();

	const noJs = await browser.newContext({
		viewport: { width: 390, height: 844 },
		javaScriptEnabled: false,
	});
	const noJsPage = await noJs.newPage();
	await noJsPage.goto(url + path, { waitUntil: "load" });
	if (await noJsPage.locator("[data-catalog-search]").first().isVisible()) {
		failures.push(
			`${label}: senza JavaScript la casella di ricerca si vede (controllo inerte)`,
		);
	}
	const hidden = await noJsPage.evaluate(
		() =>
			[...document.querySelectorAll<HTMLElement>("[data-search]")].filter(
				(item) => item.hidden,
			).length,
	);
	if (hidden > 0) {
		failures.push(
			`${label}: senza JavaScript ${hidden} elementi risultano nascosti`,
		);
	}
	await noJs.close();
}

/**
 * Viste del catalogo (`[data-catalog-views]`): con JavaScript si vede un solo gruppo alla volta
 * (controllo sulla visibilità vera, non sull'attributo); durante una ricerca si vedono i risultati
 * di tutti i gruppi; svuotata la ricerca torna il gruppo scelto; un'ancora dentro un gruppo lo apre.
 * Senza JavaScript si vedono tutti i gruppi.
 */
export async function checkCatalogViews(
	browser: Browser,
	url: string,
	path: string,
	label: string,
	failures: string[],
): Promise<void> {
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
	});
	const page = await context.newPage();
	await page.goto(url + path, { waitUntil: "load" });
	const info = await page.evaluate(() => {
		const panels = [
			...document.querySelectorAll<HTMLElement>("[data-view-panel]"),
		];
		const indexes = panels
			.slice(0, 2)
			.map((panel) =>
				[...panel.querySelectorAll<HTMLElement>("[data-search]")].map(
					(item) => item.dataset.search ?? "",
				),
			);
		const queries = indexes.map((items, index) => {
			const other = indexes[1 - index] ?? [];
			const words = items.flatMap((item) => item.split(" ")).filter(Boolean);
			const word =
				words.find((term) => !other.some((item) => item.includes(term))) ??
				words[0];
			return {
				word,
				results: indexes.map(
					(group) => group.filter((item) => word && item.includes(word)).length,
				),
			};
		});
		return {
			ids: panels.map((panel) => panel.id),
			queries,
			inner: panels.map(
				(panel) =>
					panel.querySelector<HTMLElement>("[id]:not([data-view-panel])")?.id ??
					"",
			),
		};
	});
	if (info.ids.length < 2) {
		await context.close();
		return;
	}
	const [idA, idB] = info.ids as [string, string];
	const visible = (id: string) => page.locator(`#${id}`).isVisible();
	const itemsVisible = (id: string) =>
		page.locator(`#${id} [data-search]:visible`).count();

	if (!(await visible(idA)) || (await visible(idB))) {
		failures.push(`${label}: all'apertura si deve vedere solo il primo gruppo`);
	}
	await page.locator(`[data-view-button][href="#${idB}"]`).click();
	if (
		(await visible(idA)) ||
		!(await visible(idB)) ||
		(await itemsVisible(idB)) === 0
	) {
		failures.push(
			`${label}: cliccando il secondo gruppo si deve vedere solo quello`,
		);
	}
	const search = page.locator("[data-catalog-search] input").first();
	for (const { word, results } of info.queries) {
		if (!word) {
			failures.push(`${label}: un gruppo del catalogo è senza testo cercabile`);
			continue;
		}
		await search.fill(word);
		if (
			(await itemsVisible(idA)) !== results[0] ||
			(await itemsVisible(idB)) !== results[1]
		) {
			failures.push(
				`${label}: cercando "${word}" i risultati nei gruppi non tornano`,
			);
		}
	}
	await search.fill("");
	if ((await visible(idA)) || !(await visible(idB))) {
		failures.push(
			`${label}: svuotando la ricerca deve tornare il gruppo scelto`,
		);
	}
	await context.close();

	const inner = info.inner[1];
	if (inner) {
		const deep = await browser.newContext({
			viewport: { width: 390, height: 844 },
		});
		const deepPage = await deep.newPage();
		await deepPage.goto(`${url}${path}#${inner}`, { waitUntil: "load" });
		if (
			!(await deepPage.locator(`#${idB}`).isVisible()) ||
			(await deepPage.locator(`#${idA}`).isVisible())
		) {
			failures.push(
				`${label}: un'ancora dentro il secondo gruppo deve aprirlo`,
			);
		}
		await deep.close();
	}

	const noJs = await browser.newContext({
		viewport: { width: 390, height: 844 },
		javaScriptEnabled: false,
	});
	const noJsPage = await noJs.newPage();
	await noJsPage.goto(url + path, { waitUntil: "load" });
	if (
		!(await noJsPage.locator(`#${idA}`).isVisible()) ||
		!(await noJsPage.locator(`#${idB}`).isVisible())
	) {
		failures.push(`${label}: senza JavaScript si devono vedere tutti i gruppi`);
	}
	await noJs.close();
}
