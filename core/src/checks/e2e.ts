import {
	existsSync,
	readdirSync,
	readFileSync,
	realpathSync,
	statSync,
} from "node:fs";
import { createServer } from "node:http";
import { availableParallelism, homedir } from "node:os";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { contrastRatio } from "@siti/design";
import { type Browser, chromium } from "playwright-core";
import { parseHeadersFile, TURNSTILE_ORIGIN } from "../content/security.ts";
import { checkCatalogSearch, checkCatalogViews } from "./e2e/catalog.ts";
import { checkOpenStatus, checkValidDates } from "./e2e/dates.ts";
import { checkGalleryFan, checkLightbox } from "./e2e/gallery.ts";
import { checkMotionLevels, checkScroll } from "./e2e/motion.ts";
import {
	checkHeroFirstScreen,
	checkScrollTopAndMenu,
	checkShell,
} from "./e2e/navigation.ts";
import { undeclaredStorage } from "./storage-rules.ts";

/**
 * Prove nel browser vero sul sito costruito (`dist/`), condivise da tutti i siti.
 * Per ogni pagina e per ogni larghezza (390 telefono, 1440 desktop):
 *  - axe (WCAG 2.2 AA) senza violazioni, anche con una finestra o un pannello aperto non
 *    c'è ancora: gli stati aperti li aggiungono le sezioni che li hanno;
 *  - nessuno scorrimento orizzontale;
 *  - con JavaScript spento la pagina mostra il suo `h1` (i contenuti essenziali non
 *    dipendono dagli script);
 *  - con `prefers-reduced-motion: reduce` le transizioni dei pulsanti durano un istante;
 *  - il contrasto del pulsante pieno, anche in hover, è almeno 4,5:1.
 * Serve `dist/` con un server statico proprio: non si usa `astro preview`.
 */
export const VIEWPORTS = [
	{ name: "390", width: 390, height: 844 },
	{ name: "1440", width: 1440, height: 900 },
] as const;

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".css": "text/css",
	".js": "text/javascript",
	".mjs": "text/javascript",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".webp": "image/webp",
	".avif": "image/avif",
	".woff2": "font/woff2",
	".woff": "font/woff",
	".xml": "application/xml",
	".txt": "text/plain",
};

/**
 * Percorsi delle pagine nella cartella di build: ogni `index.html` (`/`, `/en/`…) e le altre
 * pagine `.html` (come `404.html`, servita da un host come pagina di errore e quindi provata
 * anche lei). `_astro/` è output di Astro, non pagine.
 */
export function listPages(distDir: string): string[] {
	return readdirSync(distDir, { recursive: true, encoding: "utf8" })
		.map((name) => name.replace(/\\/g, "/"))
		.filter((name) => name.endsWith(".html") && !name.startsWith("_astro/"))
		.map((name) =>
			name === "index.html" || name.endsWith("/index.html")
				? `/${name.slice(0, -"index.html".length)}`
				: `/${name}`,
		)
		.sort();
}

function isWithin(root: string, path: string): boolean {
	return (
		path === root || path.startsWith(root.endsWith(sep) ? root : root + sep)
	);
}

/** `false` indica un percorso fuori da dist, `undefined` un percorso inesistente. */
function realPathIn(root: string, path: string): string | false | undefined {
	try {
		const real = realpathSync(path);
		return isWithin(root, real) ? real : false;
	} catch (error) {
		const { code } = error as NodeJS.ErrnoException;
		if (code === "ENOENT" || code === "ENOTDIR" || code === "ENAMETOOLONG")
			return undefined;
		if (code === "ELOOP" || code === "EACCES" || code === "EPERM") return false;
		throw error;
	}
}

export async function serve(distDir: string) {
	const root = realpathSync(resolve(distDir));
	// Come fa Cloudflare con `_headers`: le intestazioni di sicurezza valgono per ogni risposta.
	const headersFile = realPathIn(root, join(root, "_headers"));
	const siteHeaders =
		headersFile && statSync(headersFile).isFile()
			? parseHeadersFile(readFileSync(headersFile, "utf8"))
			: {};
	const server = createServer((request, response) => {
		let path: string;
		try {
			path = decodeURIComponent((request.url ?? "/").split("?")[0] ?? "/");
		} catch {
			// indirizzo malformato (`/%E0%A4%A`): risposta 400, il server non cade
			response.writeHead(400).end("indirizzo non valido");
			return;
		}
		if (path.includes("\0")) {
			response.writeHead(400).end("indirizzo non valido");
			return;
		}
		let file = normalize(join(root, path));
		if (!isWithin(root, file)) {
			response.writeHead(403).end();
			return;
		}
		let real = realPathIn(root, file);
		if (real && statSync(real).isDirectory()) {
			file = join(file, "index.html");
			real = realPathIn(root, file);
		}
		if (real === false) {
			response.writeHead(403).end();
			return;
		}
		let status = 200;
		if (!real || !statSync(real).isFile()) {
			status = 404;
			let directory = dirname(file);
			while (true) {
				// Anche un file assente può trovarsi sotto un symlink a una directory esterna.
				if (realPathIn(root, directory) === false) {
					response.writeHead(403).end();
					return;
				}
				file = join(directory, "404.html");
				real = realPathIn(root, file);
				if (real === false) {
					response.writeHead(403).end();
					return;
				}
				if (real && statSync(real).isFile()) break;
				if (directory === root) {
					response.writeHead(404, siteHeaders).end("non trovato");
					return;
				}
				directory = dirname(directory);
			}
		}
		response.writeHead(status, {
			...siteHeaders,
			"content-type": MIME[extname(file)] ?? "application/octet-stream",
		});
		response.end(readFileSync(real));
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const port = typeof address === "object" && address ? address.port : 0;
	return {
		url: `http://127.0.0.1:${port}`,
		close: () => new Promise<void>((resolve) => server.close(() => resolve())),
	};
}

/**
 * Chromium da usare: `SITI_CHROMIUM_PATH`, poi quello atteso da playwright-core, poi il più
 * recente già presente nella cache. Osservato (19/11/2026): il build 1248 in cache ha
 * funzionato con playwright-core 1.65.0, che ne aspetta uno più recente (1254); non è
 * garantito in generale. In CI va installato il build esatto.
 */
export function findChromium(): string {
	const fromEnv = process.env.SITI_CHROMIUM_PATH;
	if (fromEnv && existsSync(fromEnv)) return fromEnv;
	const expected = chromium.executablePath();
	if (existsSync(expected)) return expected;
	const cache = join(homedir(), ".cache", "ms-playwright");
	if (existsSync(cache)) {
		const candidates = readdirSync(cache)
			.filter((name) => /^chromium-\d+$/.test(name))
			.sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))
			.map((name) => join(cache, name, "chrome-linux64", "chrome"))
			.filter((path) => existsSync(path));
		if (candidates[0]) return candidates[0];
	}
	throw new Error(
		"Chromium non trovato: installalo con Playwright o indica il percorso in SITI_CHROMIUM_PATH.",
	);
}

/** `rgb` letto dal browser (anche da `oklab`/`color-mix`) → `#rrggbb`. */
export function toHex(rgb: number[]): string {
	return `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Intestazione e collegamenti obbligatori di ogni pagina, più cookie e storage: canonical,
 * Open Graph, `twitter:` e icona (che deve rispondere); i link alle pagine legali nel piè di pagina
 * devono portare a pagine vere; nel browser non c'è nulla di non dichiarato (`storage-rules.ts`),
 * né dopo il caricamento né dopo aver usato ricerca e modulo (senza inviarlo).
 */
async function checkHeadAndStorage(
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

	const head = await page.evaluate(() => {
		const meta = (selector: string) =>
			document.querySelector<HTMLMetaElement>(selector)?.content ?? "";
		return {
			canonical:
				document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
					?.href ?? "",
			ogTitle: meta('meta[property="og:title"]'),
			ogDescription: meta('meta[property="og:description"]'),
			ogUrl: meta('meta[property="og:url"]'),
			ogLocale: meta('meta[property="og:locale"]'),
			twitterCard: meta('meta[name="twitter:card"]'),
			icon:
				document
					.querySelector<HTMLLinkElement>('link[rel="icon"]')
					?.getAttribute("href") ?? "",
			legal: [
				...document.querySelectorAll<HTMLAnchorElement>("[data-legal-links] a"),
			].map((a) => a.getAttribute("href") ?? ""),
		};
	});
	for (const [name, value] of Object.entries({
		canonical: head.canonical,
		"og:title": head.ogTitle,
		"og:description": head.ogDescription,
		"og:url": head.ogUrl,
		"og:locale": head.ogLocale,
		"twitter:card": head.twitterCard,
		"link icon": head.icon,
	})) {
		if (!value) failures.push(`${label}: manca ${name}`);
	}
	if (head.icon) {
		const response = await fetch(new URL(head.icon, url));
		if (
			!response.ok ||
			!(response.headers.get("content-type") ?? "").includes("svg")
		) {
			failures.push(`${label}: l'icona ${head.icon} non risponde come SVG`);
		}
	}
	for (const href of head.legal) {
		const response = await fetch(new URL(href, url));
		const body = response.ok ? await response.text() : "";
		if (!response.ok || !/<h1[\s>]/.test(body)) {
			failures.push(`${label}: il link legale ${href} non porta a una pagina`);
		}
	}

	const snapshot = async () => ({
		cookies: (await context.cookies()).map((cookie) => cookie.name),
		...(await page.evaluate(() => ({
			localStorage: Object.keys(localStorage),
			sessionStorage: Object.keys(sessionStorage),
		}))),
	});
	const report = (
		when: string,
		found: Awaited<ReturnType<typeof snapshot>>,
	) => {
		for (const item of undeclaredStorage(found)) {
			failures.push(
				`${label}: ${when} il browser contiene ${item}, non dichiarato nell'informativa sui cookie`,
			);
		}
	};
	report("dopo il caricamento", await snapshot());

	const search = page.locator("[data-catalog-search] input");
	if ((await search.count()) > 0 && (await search.first().isVisible())) {
		await search.first().fill("a");
	}
	const form = page.locator("form[method='post']").first();
	if ((await form.count()) > 0) {
		await form.locator("input[type='text']").first().fill("Prova");
		await form.locator("input[type='checkbox']").first().check();
	}
	report("dopo aver usato ricerca e modulo", await snapshot());
	await context.close();
}

export interface E2eResult {
	failures: string[];
	/** Cose non verificate su una pagina (non sono errori): per esempio nessun pulsante pieno. */
	notes: string[];
	pages: number;
}

/** Il primo pulsante pieno VISIBILE della pagina (un popover chiuso non conta). */
const FILLED_BUTTON = "a.bg-accent, button.bg-accent";

/** Quanti lavori in parallelo: 3 per default (la CPU è condivisa con gli altri pacchetti), `E2E_CONCURRENCY` per cambiare. */
export function e2eConcurrency(): number {
	const fromEnv = Number.parseInt(process.env.E2E_CONCURRENCY ?? "", 10);
	if (Number.isInteger(fromEnv) && fromEnv >= 1) return fromEnv;
	return Math.max(1, Math.min(3, availableParallelism()));
}

/** Esegue `work` su ogni elemento con al massimo `size` lavori alla volta. Se uno fallisce, lo propaga. */
export async function runPool<T>(
	items: readonly T[],
	size: number,
	work: (item: T) => Promise<void>,
): Promise<void> {
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const item = items[next++] as T;
			await work(item);
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(Math.max(1, size), items.length) }, worker),
	);
}

async function checkServedPolicy(
	browser: Browser,
	url: string,
	failures: string[],
) {
	const context = await browser.newContext({ serviceWorkers: "block" });
	const frameTest = `${url}/__siti-framing-test`;
	try {
		await context.route("**/*", (route) => {
			const request = new URL(route.request().url());
			if (request.origin === TURNSTILE_ORIGIN) {
				return route.fulfill({
					contentType: "application/javascript",
					body: "/* stub Turnstile */",
				});
			}
			if (request.href === frameTest) {
				return route.fulfill({
					contentType: "text/html",
					body: '<!doctype html><iframe src="/"></iframe>',
				});
			}
			return request.origin === url ? route.continue() : route.abort();
		});
		const page = await context.newPage();
		await page.goto(url, { waitUntil: "load" });
		const assets = await page.evaluate(async () => {
			await document.fonts.ready;
			const styles = [...document.querySelectorAll("style")];
			return {
				fonts: [...document.fonts].some((font) => font.status === "loaded"),
				styles:
					styles.length > 0 &&
					styles.every((style) => (style.sheet?.cssRules.length ?? 0) > 0),
				theme: Boolean(
					getComputedStyle(document.body).getPropertyValue("--t-ink").trim(),
				),
			};
		});
		if (!assets.fonts)
			failures.push("CSP: nessun font self-hosted applicato sulla home");
		if (!assets.styles || !assets.theme)
			failures.push("CSP: stili inline o tema della home non applicati");

		let refusedFrame = false;
		page.on("console", (message) => {
			if (/frame-ancestors/i.test(message.text())) refusedFrame = true;
		});
		await page.goto(frameTest, { waitUntil: "load" });
		if (
			!refusedFrame ||
			page
				.frames()
				.slice(1)
				.some((frame) => frame.url() === `${url}/`)
		) {
			failures.push(
				"CSP HTTP: il browser deve rifiutare il framing per frame-ancestors",
			);
		}
	} finally {
		await context.close();
	}
}

export async function runE2e(
	distDir: string,
	policyOnly = false,
): Promise<E2eResult> {
	const pages = listPages(distDir);
	const failures: string[] = [];
	const notes: string[] = [];
	const { url, close } = await serve(distDir);
	let browser: Browser | undefined;
	try {
		const launched = await chromium.launch({
			executablePath: findChromium(),
			args: ["--no-sandbox"],
		});
		browser = launched;
		await checkServedPolicy(launched, url, failures);
		if (policyOnly) return { failures, notes, pages: 1 };
		// Ogni contesto, di qualunque prova, segnala le violazioni della CSP: il browser le scrive in
		// console ("Refused to ..."). Una violazione è un errore del sito, non un avviso.
		const openContext = launched.newContext.bind(launched);
		launched.newContext = async (options) => {
			const context = await openContext(options);
			// Turnstile non si carica dalla rete nei test: lo script è sostituito da uno vuoto (la CSP lo
			// ammette comunque, quindi un'origine tolta dalla CSP si vede come violazione).
			await context.route("https://challenges.cloudflare.com/**", (route) =>
				route.fulfill({
					contentType: "application/javascript",
					body: "/* api.js di Turnstile sostituito dal test */",
				}),
			);
			context.on("console", (message) => {
				const text = message.text();
				if (/Content[- ]Security[- ]Policy|^Refused to /i.test(text))
					failures.push(
						`CSP violata in ${message.page()?.url() ?? "?"}: ${text.slice(0, 200)}`,
					);
			});
			return context;
		};
		// Ogni coppia pagina × larghezza è un lavoro indipendente (contesti del browser separati):
		// un piccolo gruppo di worker li esegue in parallelo.
		const tasks = VIEWPORTS.flatMap((viewport) =>
			pages.map((path) => ({ viewport, path })),
		);
		await runPool(tasks, e2eConcurrency(), async ({ viewport, path }) => {
			const browser = launched;
			const size = { width: viewport.width, height: viewport.height };
			const label = `${path} @${viewport.name}`;

			const context = await browser.newContext({ viewport: size });
			const page = await context.newPage();
			await page.goto(url + path, { waitUntil: "networkidle" });
			const axe = await new AxeBuilder({ page })
				.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
				.analyze();
			for (const violation of axe.violations) {
				failures.push(
					`${label}: axe ${violation.id} (${violation.nodes.length})`,
				);
			}
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth > window.innerWidth,
			);
			if (overflow) failures.push(`${label}: scorrimento orizzontale`);

			// Pulsante pieno: il colore deve CAMBIARE in hover e il contrasto restare >= 4,5:1
			const button = page
				.locator(FILLED_BUTTON)
				.filter({ visible: true })
				.first();
			if ((await button.count()) === 0) {
				notes.push(
					`${label}: nessun pulsante pieno visibile, hover e movimento ridotto non verificati`,
				);
			} else {
				const read = () =>
					button.evaluate((element) => {
						const toRgb = (css: string) => {
							const canvas = document.createElement("canvas").getContext("2d");
							if (!canvas) return [0, 0, 0];
							canvas.fillStyle = "#fff";
							canvas.fillRect(0, 0, 1, 1);
							canvas.fillStyle = css;
							canvas.fillRect(0, 0, 1, 1);
							return [...canvas.getImageData(0, 0, 1, 1).data].slice(0, 3);
						};
						const style = getComputedStyle(element);
						return {
							bg: toRgb(style.backgroundColor),
							fg: toRgb(style.color),
						};
					});
				const rest = await read();
				await button.hover();
				await page.waitForTimeout(300);
				const hover = await read();
				if (toHex(rest.bg) === toHex(hover.bg)) {
					failures.push(
						`${label}: il pulsante non cambia colore in hover (la regola di hover non si applica)`,
					);
				}
				for (const [state, colors] of [
					["a riposo", rest],
					["in hover", hover],
				] as const) {
					const ratio = contrastRatio(toHex(colors.fg), toHex(colors.bg));
					if (ratio < 4.5) {
						failures.push(
							`${label}: pulsante ${state} ${ratio.toFixed(2)}:1 (minimo 4,5:1)`,
						);
					}
				}
			}
			await context.close();

			const shellContext = await browser.newContext({ viewport: size });
			const shellPage = await shellContext.newPage();
			await shellPage.goto(url + path, { waitUntil: "networkidle" });
			await checkShell(shellPage, label, viewport.width, failures);
			await shellContext.close();

			await checkScroll(
				browser,
				url,
				path,
				viewport.width,
				viewport.height,
				label,
				failures,
				notes,
			);
			await checkMotionLevels(
				browser,
				url,
				path,
				viewport.width,
				viewport.height,
				label,
				failures,
			);
			if (viewport.name === "390") {
				await checkOpenStatus(browser, url, path, `${path} @390`, failures);
				await checkValidDates(browser, url, path, `${path} @390`, failures);
				await checkCatalogSearch(browser, url, path, `${path} @390`, failures);
				await checkGalleryFan(browser, url, path, `${path} @390`, failures);
				await checkLightbox(browser, url, path, `${path} @390`, failures);
				await checkScrollTopAndMenu(
					browser,
					url,
					path,
					`${path} @390`,
					failures,
				);
				await checkCatalogViews(browser, url, path, `${path} @390`, failures);
				await checkHeadAndStorage(browser, url, path, `${path} @390`, failures);
				await checkHeroFirstScreen(
					browser,
					url,
					path,
					`${path} @360x640`,
					failures,
				);
			}

			// JavaScript spento: l'h1 si vede
			const noJs = await browser.newContext({
				viewport: size,
				javaScriptEnabled: false,
			});
			const noJsPage = await noJs.newPage();
			await noJsPage.goto(url + path, { waitUntil: "load" });
			if (!(await noJsPage.locator("h1").first().isVisible())) {
				failures.push(`${label}: senza JavaScript l'h1 non si vede`);
			}
			// senza JavaScript il menu nativo si apre lo stesso (popovertarget è dichiarativo)
			const noJsTrigger = noJsPage
				.locator("button[popovertarget]")
				.filter({ visible: true })
				.first();
			if ((await noJsTrigger.count()) > 0) {
				let clicked = true;
				try {
					await noJsTrigger.click({ timeout: 5000 });
				} catch {
					clicked = false;
					failures.push(
						`${label}: senza JavaScript il pulsante del menu non è cliccabile`,
					);
				}
				if (
					clicked &&
					(await noJsPage.locator("nav[popover]:popover-open").count()) === 0
				) {
					failures.push(`${label}: senza JavaScript il menu non si apre`);
				}
			}
			await noJs.close();

			// Movimento ridotto: le transizioni dei pulsanti durano un istante
			const reduced = await browser.newContext({
				viewport: size,
				reducedMotion: "reduce",
			});
			const reducedPage = await reduced.newPage();
			await reducedPage.goto(url + path, { waitUntil: "load" });
			const link = reducedPage
				.locator(FILLED_BUTTON)
				.filter({ visible: true })
				.first();
			if ((await link.count()) > 0) {
				const seconds = await link.evaluate((element) =>
					Number.parseFloat(getComputedStyle(element).transitionDuration),
				);
				if (seconds > 0.001) {
					failures.push(
						`${label}: con movimento ridotto la transizione dura ${seconds}s`,
					);
				}
			}
			await reduced.close();
		});
	} finally {
		await browser?.close();
		await close();
	}
	// L'ordine di arrivo dipende dalla velocità dei worker: si ordina perché il rapporto sia stabile.
	failures.sort();
	notes.sort();
	return { failures, notes, pages: pages.length };
}
