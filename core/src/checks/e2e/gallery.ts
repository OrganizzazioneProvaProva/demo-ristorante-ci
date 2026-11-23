import type { Browser, Page } from "playwright-core";

/**
 * Ingrandimento delle foto (`[data-lightbox-root]`): un clic apre la foto grande (buona parte dello
 * schermo), un clic sulla foto o Esc la chiude; con movimento ridotto è immediato; senza JavaScript
 * ogni miniatura è un link all'immagine intera.
 */
export async function checkLightbox(
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
	const total = await probePage.locator("[data-lightbox-open]").count();
	await probe.close();
	if (total === 0) return;

	for (const [width, height, reducedMotion] of [
		[390, 844, "no-preference"],
		[1440, 900, "no-preference"],
		[390, 844, "reduce"],
	] as const) {
		const where = `${label}, ${width}px${reducedMotion === "reduce" ? " con movimento ridotto" : ""}`;
		const context = await browser.newContext({
			viewport: { width, height },
			reducedMotion,
		});
		const page = await context.newPage();
		await page.goto(url + path, { waitUntil: "load" });
		const isOpen = () =>
			page.evaluate(() => document.querySelector("dialog")?.open ?? false);
		const settle = () =>
			page.waitForTimeout(reducedMotion === "reduce" ? 100 : 800);
		for (const closeWith of ["click", "Escape"] as const) {
			await page.locator("[data-lightbox-open]").first().click();
			if (reducedMotion === "no-preference") {
				// Durante l'animazione si muove solo la foto: nessun gruppo di transizione dell'intestazione
				// o della barra (restava nitido sopra lo sfondo sfocato).
				await page.waitForTimeout(60);
				const groups = await page.evaluate(() =>
					document
						.getAnimations()
						.map(
							(a) => (a.effect as KeyframeEffect | null)?.pseudoElement ?? "",
						)
						.filter((name) => name.includes("view-transition")),
				);
				if (groups.some((name) => /site-header|site-action-bar/.test(name))) {
					failures.push(
						`${where}: durante l'ingrandimento l'intestazione resta un gruppo a parte sopra lo sfondo (${closeWith})`,
					);
				}
				if (!groups.some((name) => name.includes("lightbox"))) {
					failures.push(
						`${where}: l'animazione dell'ingrandimento non parte (${closeWith})`,
					);
				}
			}
			await settle();
			if (!(await isOpen())) {
				failures.push(`${where}: il clic sulla foto non la ingrandisce`);
				break;
			}
			const box = await page.locator("dialog img").boundingBox();
			// La foto non deve coprire la barra in alto: parte sotto il suo bordo inferiore.
			const headerBottom = await page.evaluate(
				() =>
					document.querySelector("header")?.getBoundingClientRect().bottom ?? 0,
			);
			if (box && box.y < headerBottom - 1) {
				failures.push(
					`${where}: la foto ingrandita copre la barra in alto (foto da ${Math.round(box.y)}px, barra fino a ${Math.round(headerBottom)}px)`,
				);
			}
			if (!box || (box.width < width * 0.6 && box.height < height * 0.6)) {
				failures.push(
					`${where}: la foto ingrandita deve occupare buona parte dello schermo`,
				);
			}
			if (closeWith === "click") await page.locator("dialog img").click();
			else await page.keyboard.press("Escape");
			await settle();
			if (await isOpen()) {
				failures.push(
					`${where}: la foto ingrandita non si chiude (${closeWith})`,
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
	const links = await noJsPage.evaluate(
		() =>
			[
				...document.querySelectorAll<HTMLAnchorElement>("[data-lightbox-open]"),
			].filter((a) => a.getAttribute("href")).length,
	);
	if (links !== total) {
		failures.push(
			`${label}: senza JavaScript ogni foto deve essere un link all'immagine intera`,
		);
	}
	await noJs.close();
}

/**
 * Galleria a ventaglio (`[data-fan]`): 3 foto visibili sul telefono e 5 su computer, pulsanti,
 * tastiera e trascinamento che cambiano la foto al centro, pulsanti disattivati ai bordi, nessuna
 * rotazione con movimento ridotto; senza JavaScript la regione è una fila scorrevole intera.
 */
export async function checkGalleryFan(
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
	const total = await probePage.locator("[data-fan-slide]").count();
	await probe.close();
	if (total === 0) return;

	const state = (page: Page) =>
		page.evaluate(() => {
			const slides = [
				...document.querySelectorAll<HTMLElement>("[data-fan-slide]"),
			];
			return {
				active: slides.findIndex(
					(s) => s.getAttribute("aria-current") === "true",
				),
				// Foto che si vedono davvero: non nascoste e non trasparenti (la foto di scorta ha opacità 0).
				visible: slides.filter((s) => {
					const style = getComputedStyle(s);
					return style.visibility !== "hidden" && Number(style.opacity) > 0.05;
				}).length,
				prevDisabled:
					document.querySelector<HTMLButtonElement>("[data-fan-prev]")
						?.disabled ?? false,
				nextDisabled:
					document.querySelector<HTMLButtonElement>("[data-fan-next]")
						?.disabled ?? false,
			};
		});

	for (const [width, expected] of [
		[390, 3],
		[1440, 5],
	] as const) {
		const context = await browser.newContext({
			viewport: { width, height: 900 },
		});
		const page = await context.newPage();
		await page.goto(url + path, { waitUntil: "load" });
		if ((await page.locator("[data-fan][data-fan-ready]").count()) === 0) {
			failures.push(
				`${label}: a ${width}px il ventaglio non si attiva (manca data-fan-ready)`,
			);
		}
		const start = await state(page);
		const want = Math.min(expected, total);
		// Visibilità vera (non l'attributo): quante foto si vedono davvero.
		const shown = start.visible;
		if (start.visible !== want || shown !== want) {
			failures.push(
				`${label}: a ${width}px si devono vedere ${want} foto del ventaglio, se ne vedono ${shown}`,
			);
		}
		// Controllo positivo: in condizioni normali le foto laterali sono ruotate (dopo la transizione
		// di apertura, che dura `--motion-slow`).
		await page.waitForTimeout(600);
		const rotatedNormally = await page.evaluate(() =>
			[...document.querySelectorAll<HTMLElement>("[data-fan-slide]")].some(
				(slide) =>
					Math.abs(new DOMMatrixReadOnly(getComputedStyle(slide).transform).b) >
					0.001,
			),
		);
		if (!rotatedNormally && total > 1) {
			failures.push(
				`${label}: a ${width}px le foto laterali del ventaglio non sono ruotate`,
			);
		}
		await page.locator("[data-fan-next]").click();
		const afterNext = await state(page);
		if (afterNext.active !== start.active + 1 && !afterNext.nextDisabled) {
			failures.push(
				`${label}: il pulsante Avanti non cambia la foto al centro`,
			);
		}
		// Il ventaglio è un ciclo infinito (la galleria lo usa solo con almeno 6 foto): nessun bordo.
		await page.locator("[data-fan-prev]").click();
		await page.waitForTimeout(450);
		{
			// Un giro completo in avanti: ad ogni passo si vedono sempre le stesse foto, i pulsanti restano
			// attivi e dopo `total` passi si torna alla foto di partenza (la prima ricompare dopo l'ultima).
			for (let step = 1; step <= total; step++) {
				await page.locator("[data-fan-next]").click();
				await page.waitForTimeout(450);
				const now = await state(page);
				if (now.visible !== want) {
					failures.push(
						`${label}: a ${width}px al passo ${step} del giro si vedono ${now.visible} foto invece di ${want}`,
					);
				}
				if (now.prevDisabled || now.nextDisabled) {
					failures.push(
						`${label}: nel ciclo infinito i pulsanti non si disattivano`,
					);
				}
			}
			if ((await state(page)).active !== start.active) {
				failures.push(
					`${label}: dopo un giro completo non si torna alla stessa foto`,
				);
			}
			// Da capo: andando indietro dalla prima si arriva all'ultima.
			while ((await state(page)).active !== 0) {
				await page.keyboard.press("ArrowLeft");
			}
			await page.keyboard.press("ArrowLeft");
			await page.waitForTimeout(450);
			const wrapped = await state(page);
			if (wrapped.active !== total - 1 || wrapped.visible !== want) {
				failures.push(
					`${label}: indietro dalla prima foto si deve arrivare all'ultima (foto ${wrapped.active}, visibili ${wrapped.visible})`,
				);
			}
			await page.keyboard.press("ArrowRight");
			await page.waitForTimeout(450);
		}
		const atStart = await state(page);
		// Trascinamento: verso sinistra avanza di una foto.
		const box = await page.locator("[data-fan-viewport]").boundingBox();
		if (box) {
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
			await page.mouse.down();
			await page.mouse.move(
				box.x + box.width / 2 - 120,
				box.y + box.height / 2,
				{
					steps: 6,
				},
			);
			await page.mouse.up();
			const dragged = await state(page);
			if (dragged.active !== (atStart.active + 1) % total) {
				failures.push(`${label}: trascinando a sinistra la foto non avanza`);
			}
		}
		// Clic su una foto laterale: diventa quella al centro.
		const current = (await state(page)).active;
		if (current + 1 < total) {
			const side = await page
				.locator("[data-fan-slide]")
				.nth(current + 1)
				.boundingBox();
			if (side) {
				await page.mouse.click(
					side.x + side.width / 2,
					side.y + side.height / 2,
				);
				const afterClick = await state(page);
				if (afterClick.active !== current + 1) {
					failures.push(
						`${label}: cliccando la foto laterale non va al centro`,
					);
				}
			}
		}
		const status = await page.locator("[data-fan-status]").textContent();
		if (!status || !/\d/.test(status)) {
			failures.push(`${label}: la posizione ("Foto n di N") non è annunciata`);
		}
		await context.close();
	}

	const reduced = await browser.newContext({
		viewport: { width: 1440, height: 900 },
		reducedMotion: "reduce",
	});
	const reducedPage = await reduced.newPage();
	await reducedPage.goto(url + path, { waitUntil: "load" });
	const rotated = await reducedPage.evaluate(() =>
		[...document.querySelectorAll<HTMLElement>("[data-fan-slide]")].some(
			(slide) => {
				const matrix = new DOMMatrixReadOnly(getComputedStyle(slide).transform);
				return Math.abs(matrix.b) > 0.001;
			},
		),
	);
	if (rotated) {
		failures.push(
			`${label}: con movimento ridotto le foto non devono essere ruotate`,
		);
	}
	await reduced.close();

	const noJs = await browser.newContext({
		viewport: { width: 390, height: 844 },
		javaScriptEnabled: false,
	});
	const noJsPage = await noJs.newPage();
	await noJsPage.goto(url + path, { waitUntil: "load" });
	const controlsVisible = await noJsPage
		.locator("[data-fan-controls]")
		.isVisible();
	const scrolls = await noJsPage.evaluate(() => {
		const viewport = document.querySelector<HTMLElement>("[data-fan-viewport]");
		return viewport ? viewport.scrollWidth > viewport.clientWidth : true;
	});
	if (controlsVisible || !scrolls) {
		failures.push(
			`${label}: senza JavaScript i pulsanti devono sparire e le foto scorrere in una fila`,
		);
	}
	await noJs.close();
}
