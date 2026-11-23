import type { Browser, Page } from "playwright-core";

/**
 * Tasto "torna all'inizio" e menu a hamburger sul telefono (390 px):
 * - il tasto riporta in cima, non copre la barra di azioni e sta sopra di essa;
 * - il menu si apre sotto l'intestazione, alto quanto le sue voci (non copre la pagina), e le tre barre
 *   del pulsante diventano una X; richiudendo tornano barre.
 */
export async function checkScrollTopAndMenu(
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

	const top = page.locator("[data-scroll-top]");
	if ((await top.count()) > 0) {
		const opacityNow = () =>
			top
				.first()
				.evaluate((element) => Number(getComputedStyle(element).opacity));
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.waitForTimeout(300);
		if ((await opacityNow()) > 0.05) {
			failures.push(
				`${label}: in cima alla pagina il tasto "torna su" deve essere invisibile`,
			);
		}
		const scrollable = await page.evaluate(
			() => document.documentElement.scrollHeight > window.innerHeight * 2,
		);
		if (scrollable) {
			// Pagine con una fascia guida (la home): invisibile fino alla sua fine, poi sempre meno
			// trasparente fino al 70% all'inizio della sezione dopo.
			const ramp = await page.evaluate(() => {
				const element = document.querySelector("[data-scroll-top-ramp]");
				if (!element) return undefined;
				const box = element.getBoundingClientRect();
				return { top: box.top + window.scrollY, height: box.height };
			});
			if (ramp) {
				await page.evaluate(
					(y) => window.scrollTo(0, y),
					Math.max(0, ramp.top - 60),
				);
				await page.waitForTimeout(300);
				if ((await opacityNow()) > 0.05) {
					failures.push(
						`${label}: prima della fine della galleria il tasto "torna su" deve essere invisibile`,
					);
				}
				await page.evaluate(
					(y) => window.scrollTo(0, y),
					ramp.top + ramp.height / 2,
				);
				await page.waitForTimeout(300);
				const middle = await opacityNow();
				if (middle < 0.1 || middle > 0.6) {
					failures.push(
						`${label}: a metà della fascia il tasto "torna su" dovrebbe essere a metà strada (opacità ${middle.toFixed(2)})`,
					);
				}
				await page.evaluate(
					(y) => window.scrollTo(0, y),
					ramp.top + ramp.height + 4,
				);
				await page.waitForTimeout(300);
				const end = await opacityNow();
				if (Math.abs(end - 0.7) > 0.06) {
					failures.push(
						`${label}: all'inizio della sezione dopo gli orari l'opacità deve arrivare a 0,7 (è ${end.toFixed(2)})`,
					);
				}
			}
			await page.evaluate(() =>
				window.scrollTo(0, document.documentElement.scrollHeight),
			);
			await page.waitForTimeout(500);
			const atBottom = await opacityNow();
			if (atBottom < 0.6 || atBottom > 0.75) {
				failures.push(
					`${label}: in fondo alla pagina il tasto "torna su" deve essere al 70% (è ${atBottom.toFixed(2)})`,
				);
			}
			const button = await top.first().boundingBox();
			const bar = page.locator("[data-action-bar]");
			if ((await bar.count()) > 0 && (await bar.first().isVisible())) {
				const barBox = await bar.first().boundingBox();
				if (button && barBox && button.y + button.height > barBox.y) {
					failures.push(
						`${label}: il tasto "torna su" copre la barra di azioni (fine a ${Math.round(button.y + button.height)}px, barra da ${Math.round(barBox.y)}px)`,
					);
				}
			}
			const before = await page.evaluate(() => window.scrollY);
			await top.first().click();
			// Lo scorrimento è morbido: al primo fotogramma in cui la pagina si muove non è ancora in cima
			// (uno scorrimento istantaneo andrebbe a 0 subito). Non si aspetta un tempo fisso: sotto carico
			// il movimento parte in ritardo.
			const moved = await page
				.waitForFunction((from) => window.scrollY < from, before, {
					polling: "raf",
					timeout: 3000,
				})
				.then(() => true)
				.catch(() => false);
			const during = await page.evaluate(() => window.scrollY);
			if (!moved || !(during > 4 && during < before)) {
				failures.push(
					`${label}: il tasto "torna su" deve scorrere in modo morbido (al primo movimento: ${Math.round(during)}px su ${Math.round(before)}px)`,
				);
			}
			await page
				.waitForFunction(() => window.scrollY < 2, undefined, { timeout: 4000 })
				.catch(() => {
					failures.push(`${label}: il tasto "torna su" non riporta in cima`);
				});
		}
	}

	const toggle = page.locator("[data-menu-toggle]");
	if ((await toggle.count()) > 0) {
		await page.evaluate(() => window.scrollTo(0, 0));
		const headerBottom = await page.evaluate(
			() =>
				document.querySelector("header")?.getBoundingClientRect().bottom ?? 0,
		);
		const bars = () =>
			page.evaluate(() =>
				[...document.querySelectorAll("[data-menu-toggle] span > span")].map(
					(bar) => {
						const matrix = new DOMMatrixReadOnly(
							getComputedStyle(bar).transform,
						);
						return {
							b: matrix.b,
							opacity: Number(getComputedStyle(bar).opacity),
						};
					},
				),
			);
		await toggle.first().click();
		await page.waitForTimeout(500);
		const panel = await page.locator("#site-menu").boundingBox();
		if (!panel) {
			failures.push(`${label}: il menu non si apre`);
		} else {
			if (panel.height > 844 * 0.6) {
				failures.push(
					`${label}: il menu copre troppa pagina (${Math.round(panel.height)}px su 844): deve essere alto quanto le sue voci`,
				);
			}
			// Il velo che oscura la pagina parte sotto l'intestazione, che resta ben visibile: il retro del
			// popover è trasparente e il velo è più scuro del 50%.
			const veil = await page.evaluate(() => {
				const menu = document.querySelector("#site-menu");
				if (!menu) return undefined;
				const color = (css: string) =>
					/rgba?\(([^)]+)\)/
						.exec(css)?.[1]
						?.split(",")
						.map((n) => Number.parseFloat(n)) ?? [];
				const veilElement = document.querySelector("[data-menu-veil]");
				if (!veilElement) return undefined;
				const before = getComputedStyle(veilElement);
				const box = veilElement.getBoundingClientRect();
				const backdrop = getComputedStyle(menu, "::backdrop");
				return {
					top: box.top,
					height: box.height,
					alpha: color(before.backgroundColor)[3] ?? 1,
					backdropAlpha: color(backdrop.backgroundColor)[3] ?? 1,
				};
			});
			if (veil) {
				if (veil.top < headerBottom - 2) {
					failures.push(
						`${label}: il velo del menu copre l'intestazione (parte da ${Math.round(veil.top)}px, intestazione fino a ${Math.round(headerBottom)}px)`,
					);
				}
				if (veil.height < 844 - headerBottom - 4) {
					failures.push(
						`${label}: il velo del menu non arriva in fondo alla pagina (alto ${Math.round(veil.height)}px)`,
					);
				}
				if (veil.alpha < 0.5) {
					failures.push(
						`${label}: il velo del menu è troppo chiaro (opacità ${veil.alpha.toFixed(2)})`,
					);
				}
				if (veil.backdropAlpha > 0) {
					failures.push(
						`${label}: il retro del popover deve essere trasparente, oscurerebbe anche l'intestazione`,
					);
				}
			}
			if (panel.y < headerBottom - 2) {
				failures.push(
					`${label}: il menu copre l'intestazione (parte da ${Math.round(panel.y)}px, intestazione fino a ${Math.round(headerBottom)}px)`,
				);
			}
			const open = await bars();
			if (
				!(
					Math.abs(open[0]?.b ?? 0) > 0.3 &&
					Math.abs(open[2]?.b ?? 0) > 0.3 &&
					(open[1]?.opacity ?? 1) < 0.1
				)
			) {
				failures.push(
					`${label}: a menu aperto le tre barre non diventano una X`,
				);
			}
		}
		// Il pulsante resta quello che chiude: un tocco sullo stesso punto richiude il menu.
		const buttonBox = await toggle.first().boundingBox();
		if (buttonBox) {
			await page.mouse.click(
				buttonBox.x + buttonBox.width / 2,
				buttonBox.y + buttonBox.height / 2,
			);
		}
		await page.waitForTimeout(500);
		const stillOpen = await page.evaluate(
			() =>
				document.querySelector("#site-menu")?.matches(":popover-open") ?? false,
		);
		if (stillOpen)
			failures.push(
				`${label}: toccando di nuovo il pulsante il menu non si chiude`,
			);
		const closed = await bars();
		if (!closed.every((bar) => Math.abs(bar.b) < 0.01 && bar.opacity > 0.9)) {
			failures.push(
				`${label}: a menu chiuso le tre barre non tornano orizzontali`,
			);
		}
	}
	await context.close();
}

/** Il gruppo di azioni dell'hero sta nella prima schermata di un telefono piccolo (360×640). */
export async function checkHeroFirstScreen(
	browser: Browser,
	url: string,
	path: string,
	label: string,
	failures: string[],
): Promise<void> {
	const context = await browser.newContext({
		viewport: { width: 360, height: 640 },
	});
	const page = await context.newPage();
	await page.goto(url + path, { waitUntil: "load" });
	const group = page.locator("[data-hero-actions]");
	if ((await group.count()) > 0 && (await group.first().isVisible())) {
		const bottom = await group
			.first()
			.evaluate((element) => element.getBoundingClientRect().bottom);
		if (bottom > 640) {
			failures.push(
				`${label}: le azioni dell'hero non stanno nella prima schermata (fine a ${Math.round(bottom)}px su 640)`,
			);
		}
	}
	await context.close();
}

/** Larghezza da cui il menu è una lista in linea (breakpoint `md` di Tailwind: 48 rem). */
export const DESKTOP_MIN_WIDTH = 768;

const MAX_TAB_STOPS = 80;

/**
 * Il guscio (intestazione con menu `popover`, barra di azioni fissa): si prova solo dove c'è.
 * - telefono: il menu si apre, il focus entra nel pannello, Esc lo chiude;
 * - desktop: i link della navigazione si vedono senza aprire nulla;
 * - barra fissa: percorrendo la pagina con Tab, nessun elemento col focus finisce sotto la
 *   barra (WCAG 2.4.11, Focus Not Obscured).
 */
export async function checkShell(
	page: Page,
	label: string,
	width: number,
	failures: string[],
): Promise<void> {
	// Il caricamento non deve spostare il focus (per esempio un autofocus che si attiva da solo).
	const loadedOnBody = await page.evaluate(
		() => document.activeElement === document.body,
	);
	if (!loadedOnBody) {
		failures.push(
			`${label}: al caricamento il focus non è sul documento (qualcosa lo ha preso)`,
		);
	}

	const menu = page.locator("nav[popover]");
	if (
		(await menu.count()) === 0 &&
		(await page.locator("button[popovertarget]").count()) > 0
	) {
		failures.push(
			`${label}: c'è un pulsante popovertarget ma nessun pannello nav[popover]`,
		);
	}
	if ((await menu.count()) > 0) {
		if (width >= DESKTOP_MIN_WIDTH) {
			if (!(await menu.locator("a").first().isVisible())) {
				failures.push(
					`${label}: su desktop i link della navigazione non si vedono`,
				);
			}
		} else {
			const trigger = page
				.locator("button[popovertarget]")
				.filter({ visible: true })
				.first();
			try {
				await trigger.click({ timeout: 5000 });
			} catch {
				failures.push(
					`${label}: il pulsante del menu non è cliccabile (coperto da altro?)`,
				);
				return;
			}
			if ((await page.locator("nav[popover]:popover-open").count()) === 0) {
				failures.push(`${label}: il menu non si apre`);
			} else {
				// L'evento di apertura del pannello arriva subito dopo il clic: il focus entra un attimo dopo.
				await page.waitForTimeout(150);
				const focusInside = await page.evaluate(
					() =>
						document
							.querySelector("nav[popover]")
							?.contains(document.activeElement) ?? false,
				);
				if (!focusInside) {
					failures.push(
						`${label}: aprendo il menu il focus non entra nel pannello`,
					);
				}
				await page.keyboard.press("Escape");
				if ((await page.locator("nav[popover]:popover-open").count()) > 0) {
					failures.push(`${label}: Esc non chiude il menu`);
				}
				// chiudendo, il focus torna al pulsante che ha aperto il menu
				const focusOnTrigger = await trigger.evaluate(
					(element) => element === document.activeElement,
				);
				if (!focusOnTrigger) {
					failures.push(
						`${label}: chiudendo il menu con Esc il focus non torna al pulsante`,
					);
				}
			}
		}
	}

	const bar = page.locator("[data-action-bar]");
	if ((await bar.count()) > 0 && (await bar.first().isVisible())) {
		// lo scroll-padding di <html> deve coprire l'altezza della barra: così un elemento che
		// riceve il focus viene portato sopra la barra (non dipende dalla lunghezza della pagina)
		const { padding, height } = await page.evaluate(() => ({
			padding: Number.parseFloat(
				getComputedStyle(document.documentElement).scrollPaddingBottom,
			),
			height:
				document.querySelector("[data-action-bar]")?.getBoundingClientRect()
					.height ?? 0,
		}));
		if (!(padding >= height)) {
			failures.push(
				`${label}: scroll-padding-bottom di <html> (${Number.isNaN(padding) ? "assente" : `${padding}px`}) non copre la barra (${Math.round(height)}px)`,
			);
		}
		for (let step = 0; step < MAX_TAB_STOPS; step++) {
			await page.keyboard.press("Tab");
			const obscured = await page.evaluate(() => {
				const active = document.activeElement;
				const barElement = document.querySelector("[data-action-bar]");
				if (!active || active === document.body || !barElement) return null;
				if (barElement.contains(active)) return null;
				const a = active.getBoundingClientRect();
				const b = barElement.getBoundingClientRect();
				const overlaps =
					a.bottom > b.top &&
					a.top < b.bottom &&
					a.right > b.left &&
					a.left < b.right;
				return overlaps
					? `${active.tagName.toLowerCase()} "${(active.textContent ?? "").trim().slice(0, 30)}"`
					: null;
			});
			if (obscured) {
				failures.push(
					`${label}: con Tab il focus finisce sotto la barra di azioni (${obscured})`,
				);
				break;
			}
		}
	}
}
