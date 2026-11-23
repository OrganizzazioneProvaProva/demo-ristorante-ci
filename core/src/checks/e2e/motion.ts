import type { Browser, Page } from "playwright-core";
import { DESKTOP_MIN_WIDTH } from "./navigation.ts";

/** Pulsanti pieni davvero visibili nella finestra ora (non nascosti, non fuori schermo). */
async function visibleFilledButtons(page: Page): Promise<string[]> {
	return page.evaluate(() =>
		[...document.querySelectorAll("a.bg-accent, button.bg-accent")]
			.filter((element) => {
				const rect = element.getBoundingClientRect();
				const style = getComputedStyle(element);
				return (
					element.getClientRects().length > 0 &&
					style.visibility !== "hidden" &&
					Number.parseFloat(style.opacity) > 0 &&
					rect.bottom > 0 &&
					rect.top < window.innerHeight &&
					rect.right > 0 &&
					rect.left < window.innerWidth
				);
			})
			.map((element) => (element.textContent ?? "").trim()),
	);
}

async function scrollTo(page: Page, y: number): Promise<void> {
	await page.evaluate((top) => window.scrollTo(0, top), y);
	await page.waitForTimeout(450);
}

/**
 * Movimento e scroll (guscio + hero): sulla pagina costruita, a 390 e 1440 px.
 * - al massimo UN pulsante pieno visibile alla volta (cima e dopo l'hero), con JavaScript,
 *   senza JavaScript e con il movimento ridotto;
 * - telefono: l'intestazione si nasconde scorrendo in basso e ricompare risalendo; desktop:
 *   sempre visibile; con il movimento ridotto sempre visibile;
 * - movimento ridotto: nessuna animazione attiva dopo lo scroll, rivelazioni visibili, barra
 *   visibile in cima e azioni dell'hero nascoste sul telefono;
 * - senza JavaScript le rivelazioni sono visibili.
 */
export async function checkScroll(
	browser: Browser,
	url: string,
	path: string,
	width: number,
	height: number,
	label: string,
	failures: string[],
	notes: string[],
): Promise<void> {
	const phone = width < DESKTOP_MIN_WIDTH;
	const open = async (options: Parameters<Browser["newContext"]>[0]) => {
		const context = await browser.newContext({
			viewport: { width, height },
			...options,
		});
		const page = await context.newPage();
		await page.goto(url + path, { waitUntil: "load" });
		return { context, page };
	};
	const heroEnd = (page: Page) =>
		page.evaluate(() => {
			const group = document.querySelector("[data-hero-actions]");
			return group
				? group.getBoundingClientRect().bottom + window.scrollY
				: null;
		});

	// 1. un solo pulsante pieno: con JavaScript, senza, con il movimento ridotto
	for (const [mode, options] of [
		["con JavaScript", {}],
		["senza JavaScript", { javaScriptEnabled: false }],
		["con movimento ridotto", { reducedMotion: "reduce" as const }],
	] as const) {
		const { context, page } = await open(options);
		const end = await heroEnd(page);
		const positions = end === null ? [0] : [0, end + 200];
		for (const y of positions) {
			if (mode !== "senza JavaScript") await scrollTo(page, y);
			else {
				await page.evaluate((top) => window.scrollTo(0, top), y);
				await page.waitForTimeout(300);
			}
			const filled = await visibleFilledButtons(page);
			if (filled.length > 1) {
				failures.push(
					`${label}: ${mode}, scroll ${Math.round(y)}: ${filled.length} pulsanti pieni visibili insieme (${filled.join(", ")})`,
				);
			}
			if (phone && end !== null && filled.length === 0) {
				failures.push(
					`${label}: ${mode}, scroll ${Math.round(y)}: nessun pulsante pieno visibile sul telefono`,
				);
			}
		}
		await context.close();
	}

	// 1a. telefono, pagina con la barra ma senza hero: la barra è visibile in cima (nessuna timeline)
	if (phone) {
		const { context, page } = await open({});
		const noHero =
			(await page.locator("[data-action-bar]").count()) > 0 &&
			(await page.locator("[data-hero-actions]").count()) === 0;
		if (noHero) {
			await page.waitForTimeout(300);
			const inViewport = await page.evaluate(() => {
				const rect = document
					.querySelector("[data-action-bar]")
					?.getBoundingClientRect();
				return rect
					? rect.top >= 0 && rect.bottom <= window.innerHeight + 1
					: false;
			});
			if (!inViewport) {
				failures.push(
					`${label}: senza hero la barra di azioni non è visibile in cima alla pagina`,
				);
			}
		}
		await context.close();
	}

	// 1b. telefono: Maiusc+Tab da cima pagina porta il focus nella barra, che deve essere in finestra
	if (phone) {
		const { context, page } = await open({});
		const hasBoth =
			(await page.locator("[data-action-bar]").count()) > 0 &&
			(await page.locator("[data-hero-actions]").count()) > 0;
		if (hasBoth) {
			await page.keyboard.press("Shift+Tab");
			await page.waitForTimeout(300);
			const state = await page.evaluate(() => {
				const bar = document.querySelector("[data-action-bar]");
				const active = document.activeElement;
				if (!bar || !active) return { inside: false, visible: false };
				const rect = bar.getBoundingClientRect();
				return {
					inside: bar.contains(active),
					visible: rect.top >= 0 && rect.bottom <= window.innerHeight + 1,
				};
			});
			if (state.inside && !state.visible) {
				failures.push(
					`${label}: con Maiusc+Tab da cima pagina il focus entra nella barra mentre è fuori schermo`,
				);
			}
		}
		await context.close();
	}

	// 2. movimento ridotto: niente animazioni, rivelazioni visibili, barra in cima, hero senza gruppo
	{
		const { context, page } = await open({ reducedMotion: "reduce" });
		await scrollTo(page, 600);
		const state = await page.evaluate(() => ({
			animations: document.getAnimations().length,
			revealHidden: [...document.querySelectorAll("[data-reveal]")].filter(
				(element) => {
					const style = getComputedStyle(element);
					return (
						Number.parseFloat(style.opacity) < 1 ||
						(style.translate !== "none" && style.translate !== "0px")
					);
				},
			).length,
		}));
		if (state.animations > 0) {
			failures.push(
				`${label}: con movimento ridotto ci sono ${state.animations} animazioni attive`,
			);
		}
		if (state.revealHidden > 0) {
			failures.push(
				`${label}: con movimento ridotto ${state.revealHidden} elementi [data-reveal] non sono nello stato finale`,
			);
		}
		if (phone) {
			await scrollTo(page, 0);
			const header = page.locator("[data-site-header]");
			if ((await header.count()) > 0) {
				const { padding, headerHeight } = await page.evaluate(() => ({
					padding: Number.parseFloat(
						getComputedStyle(document.documentElement).scrollPaddingTop,
					),
					headerHeight:
						document
							.querySelector("[data-site-header]")
							?.getBoundingClientRect().height ?? 0,
				}));
				if (!(padding >= headerHeight)) {
					failures.push(
						`${label}: scroll-padding-top di <html> (${Number.isNaN(padding) ? "assente" : `${padding}px`}) non copre l'intestazione (${Math.round(headerHeight)}px)`,
					);
				}
			}

			const bar = page.locator("[data-action-bar]");
			if ((await bar.count()) > 0 && !(await bar.first().isVisible())) {
				failures.push(
					`${label}: con movimento ridotto la barra non è visibile in cima`,
				);
			}
			const heroGroup = page.locator("[data-hero-actions]");
			if (
				(await heroGroup.count()) > 0 &&
				(await heroGroup.first().isVisible())
			) {
				failures.push(
					`${label}: con movimento ridotto il gruppo di azioni dell'hero è visibile sul telefono (due pulsanti pieni)`,
				);
			}
		}
		await context.close();
	}

	// 3. senza JavaScript le rivelazioni sono visibili in cima come in fondo
	{
		const { context, page } = await open({ javaScriptEnabled: false });
		const hidden = await page.evaluate(
			() =>
				[...document.querySelectorAll("[data-reveal]")].filter(
					(element) =>
						Number.parseFloat(getComputedStyle(element).opacity) === 0,
				).length,
		);
		await page.evaluate(() =>
			window.scrollTo(0, document.documentElement.scrollHeight),
		);
		await page.waitForTimeout(300);
		const hiddenAtEnd = await page.evaluate(
			() =>
				[...document.querySelectorAll("[data-reveal]")].filter((element) => {
					const rect = element.getBoundingClientRect();
					const inView = rect.top < window.innerHeight && rect.bottom > 0;
					return (
						inView && Number.parseFloat(getComputedStyle(element).opacity) < 1
					);
				}).length,
		);
		if (hiddenAtEnd > 0)
			failures.push(
				`${label}: senza JavaScript ${hiddenAtEnd} rivelazioni visibili in finestra sono ancora trasparenti`,
			);
		void hidden;
		await context.close();
	}

	// 4. intestazione: telefono si nasconde/ricompare, desktop sempre visibile, ridotto sempre visibile
	{
		const { context, page } = await open({});
		if ((await page.locator("[data-site-header]").count()) > 0) {
			const range = await page.evaluate(
				() => document.documentElement.scrollHeight - window.innerHeight,
			);
			const headerTop = () =>
				page.evaluate(
					() =>
						document
							.querySelector("[data-site-header]")
							?.getBoundingClientRect().bottom ?? 0,
				);
			if (range < 800) {
				notes.push(
					`${label}: pagina troppo corta (${range}px di scroll) per provare l'intestazione che si nasconde`,
				);
			} else if (phone) {
				await scrollTo(page, 600);
				if ((await headerTop()) > 1)
					failures.push(
						`${label}: scorrendo in basso l'intestazione del telefono non si nasconde`,
					);
				await scrollTo(page, 500);
				if ((await headerTop()) < 1)
					failures.push(
						`${label}: risalendo l'intestazione del telefono non ricompare`,
					);
			} else {
				await scrollTo(page, 600);
				if ((await headerTop()) < 1)
					failures.push(
						`${label}: su desktop l'intestazione deve restare visibile`,
					);
			}
		}
		await context.close();
	}
	{
		const { context, page } = await open({ reducedMotion: "reduce" });
		if ((await page.locator("[data-site-header]").count()) > 0) {
			const range = await page.evaluate(
				() => document.documentElement.scrollHeight - window.innerHeight,
			);
			if (range >= 800) {
				await scrollTo(page, 600);
				const bottom = await page.evaluate(
					() =>
						document
							.querySelector("[data-site-header]")
							?.getBoundingClientRect().bottom ?? 0,
				);
				if (bottom < 1)
					failures.push(
						`${label}: con movimento ridotto l'intestazione deve restare visibile`,
					);
			}
		}
		await context.close();
	}
}

/**
 * Livelli di movimento (`<html data-motion>`, dal `DESIGN.md`): la pagina si prova con ognuno
 * dei tre, riscrivendo l'attributo nell'HTML prima che il browser lo legga (come se il sito
 * avesse scelto quel livello). Il movimento ridotto del sistema qui è spento: lo provano
 * `checkScroll` e gli altri.
 * - `no-animation`: nessuna animazione attiva (a riposo e dopo lo scroll), un solo pulsante
 *   pieno (la barra) sul telefono, intestazione sempre ferma;
 * - `light-animation` e `expressive-animation`: le rivelazioni allo scroll esistono (così il
 *   controllo di `no-animation` non è vuoto); il livello espressivo ha token più ampi e, con
 *   il puntatore, ingrandisce le immagini `[data-zoom]` e solleva i pulsanti.
 */
export async function checkMotionLevels(
	browser: Browser,
	url: string,
	path: string,
	width: number,
	height: number,
	label: string,
	failures: string[],
): Promise<void> {
	const phone = width < DESKTOP_MIN_WIDTH;
	const tokens: Record<string, { distance: string; hero: string }> = {};

	for (const level of [
		"no-animation",
		"light-animation",
		"expressive-animation",
	]) {
		const context = await browser.newContext({ viewport: { width, height } });
		let rewritten = false;
		await context.route("**/*", async (route) => {
			// Non-documenti: si passa al gestore precedente (per esempio lo script di Turnstile sostituito).
			if (route.request().resourceType() !== "document")
				return route.fallback();
			const response = await route.fetch();
			const html = await response.text();
			const body = html.replace(
				/(<html\b[^>]*\sdata-motion=")[^"]*"/,
				`$1${level}"`,
			);
			rewritten = body !== html || html.includes(`data-motion="${level}"`);
			return route.fulfill({ response, body });
		});
		const page = await context.newPage();
		await page.goto(url + path, { waitUntil: "load" });
		const prefix = `${label}: livello ${level}`;
		const attribute = await page.evaluate(
			() => document.documentElement.dataset.motion,
		);
		if (!rewritten || attribute !== level) {
			failures.push(`${prefix}: <html data-motion> è "${attribute}"`);
			await context.close();
			continue;
		}

		tokens[level] = await page.evaluate(() => {
			const style = getComputedStyle(document.documentElement);
			return {
				distance: style.getPropertyValue("--motion-distance").trim(),
				hero: style.getPropertyValue("--motion-hero").trim(),
			};
		});
		await page.waitForTimeout(300);

		const animationNames = () =>
			page.evaluate(() =>
				document
					.getAnimations()
					.map((animation) =>
						animation instanceof CSSAnimation
							? animation.animationName
							: animation instanceof CSSTransition
								? `transition:${animation.transitionProperty}`
								: "altra",
					),
			);
		const hasReveal = await page.evaluate(
			() =>
				document.querySelectorAll("[data-reveal]").length > 0 &&
				CSS.supports("animation-timeline: view()"),
		);
		const end = await page.evaluate(() => {
			const group = document.querySelector("[data-hero-actions]");
			return group
				? group.getBoundingClientRect().bottom + window.scrollY
				: null;
		});

		if (level === "no-animation") {
			// a riposo (dopo la fine dell'assestamento dell'hero) e dopo lo scroll
			await page.waitForTimeout(1300);
			for (const y of [0, 600, (end ?? 0) + 200]) {
				await scrollTo(page, y);
				const names = await animationNames();
				if (names.length > 0) {
					failures.push(
						`${prefix}: scroll ${y}: animazioni attive (${[...new Set(names)].join(", ")})`,
					);
				}
				if (phone && end !== null) {
					const filled = await visibleFilledButtons(page);
					if (filled.length !== 1) {
						failures.push(
							`${prefix}: scroll ${y}: ${filled.length} pulsanti pieni visibili (ne serve uno, la barra)`,
						);
					}
				}
			}
			if (phone && (await page.locator("[data-site-header]").count()) > 0) {
				const range = await page.evaluate(
					() => document.documentElement.scrollHeight - window.innerHeight,
				);
				if (range >= 800) {
					await scrollTo(page, 600);
					const bottom = await page.evaluate(
						() =>
							document
								.querySelector("[data-site-header]")
								?.getBoundingClientRect().bottom ?? 0,
					);
					if (bottom < 1) {
						failures.push(
							`${prefix}: l'intestazione si nasconde scorrendo (deve restare ferma)`,
						);
					}
				}
			}
		} else {
			if (hasReveal) {
				await scrollTo(page, 600);
				if (!(await animationNames()).includes("reveal")) {
					failures.push(
						`${prefix}: nessuna rivelazione allo scroll attiva ([data-reveal])`,
					);
				}
			}
			// l'effetto con il puntatore: solo espressivo, solo desktop
			if (!phone) {
				const zoomTarget = page.locator("[data-zoom]:has(img)").first();
				if ((await zoomTarget.count()) > 0) {
					await zoomTarget.scrollIntoViewIfNeeded();
					await page.waitForTimeout(500);
					await zoomTarget.hover();
					await page.waitForTimeout(700);
					const scale = await zoomTarget
						.locator("img")
						.first()
						.evaluate((element) => getComputedStyle(element).scale);
					const zooms = scale !== "none" && Number.parseFloat(scale) > 1;
					// ogni cornice che ritaglia contiene solo l'immagine (non una scheda con testo)
					const badFrames = await page.evaluate(
						() =>
							[...document.querySelectorAll("[data-zoom]")].filter((frame) => {
								const image = frame.querySelector("img");
								return (
									image !== null &&
									(getComputedStyle(frame).overflow !== "clip" ||
										Math.abs(
											frame.getBoundingClientRect().height - image.offsetHeight,
										) > 1)
								);
							}).length,
					);
					if (level === "expressive-animation" && badFrames > 0) {
						failures.push(
							`${prefix}: ${badFrames} cornici [data-zoom] non contengono solo l'immagine o non ritagliano`,
						);
					}
					if (level === "expressive-animation" && !zooms) {
						failures.push(
							`${prefix}: le immagini [data-zoom] non si ingrandiscono in hover`,
						);
					}
					if (level === "light-animation" && zooms) {
						failures.push(
							`${prefix}: le immagini si ingrandiscono in hover (è un effetto espressivo)`,
						);
					}
				}
				// sottolineatura della navigazione: disegnata in hover solo nell'espressivo;
				// la pagina corrente resta sottolineata a riposo
				const navLinks = page
					.locator("[data-nav-link]")
					.filter({ visible: true });
				const idle = navLinks.locator("xpath=self::*[not(@aria-current)]");
				if ((await idle.count()) > 0) {
					await page.evaluate(() => window.scrollTo(0, 0));
					const link = idle.first();
					await link.hover();
					await page.waitForTimeout(700);
					const underline = await link.evaluate((element) => ({
						line: getComputedStyle(element).textDecorationLine,
						drawn: getComputedStyle(element, "::after").scale,
					}));
					const drawn = underline.drawn !== "none" && underline.drawn !== "0 1";
					if (level === "expressive-animation" && !drawn) {
						failures.push(
							`${prefix}: la sottolineatura della navigazione non si disegna in hover`,
						);
					}
					if (level === "light-animation" && drawn) {
						failures.push(
							`${prefix}: la sottolineatura si disegna in hover (è un effetto espressivo)`,
						);
					}
					if (
						level === "light-animation" &&
						!underline.line.includes("underline")
					) {
						failures.push(
							`${prefix}: in hover il link della navigazione non è sottolineato`,
						);
					}
				}
				const current = page.locator('[data-nav-link][aria-current="page"]');
				if ((await current.count()) > 0) {
					const line = await current
						.first()
						.evaluate(
							(element) => getComputedStyle(element).textDecorationLine,
						);
					if (!line.includes("underline")) {
						failures.push(`${prefix}: la pagina corrente non è sottolineata`);
					}
				}
				const button = page.locator("[data-button]").filter({ visible: true });
				if ((await button.count()) > 0) {
					await page.evaluate(() => window.scrollTo(0, 0));
					await page.waitForTimeout(400);
					const target = button.first();
					await target.hover();
					await page.waitForTimeout(700);
					const lift = await target.evaluate(
						(element) => getComputedStyle(element).translate,
					);
					const lifted = lift !== "none" && lift !== "0px";
					if (level === "expressive-animation" && !lifted) {
						failures.push(`${prefix}: il pulsante non si solleva in hover`);
					}
					if (level === "light-animation" && lifted) {
						failures.push(
							`${prefix}: il pulsante si solleva in hover (è un effetto espressivo)`,
						);
					}
				}
			}
		}
		await context.close();
	}

	const light = tokens["light-animation"];
	const expressive = tokens["expressive-animation"];
	if (light && expressive) {
		if (
			Number.parseFloat(expressive.distance) <=
				Number.parseFloat(light.distance) ||
			Number.parseFloat(expressive.hero) <= Number.parseFloat(light.hero)
		) {
			failures.push(
				`${label}: il livello espressivo non ha spostamenti e durate più ampi del leggero (${expressive.distance}/${expressive.hero} contro ${light.distance}/${light.hero})`,
			);
		}
	}
}
