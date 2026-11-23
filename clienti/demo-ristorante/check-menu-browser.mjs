import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { findChromium, serve } from "../../core/src/checks/e2e.ts";

const requireCore = createRequire(
	new URL("../../core/package.json", import.meta.url),
);
const { chromium } = requireCore("playwright-core");
const dist = fileURLToPath(new URL("./dist/", import.meta.url));
const { url, close } = await serve(dist);
let browser;
const failures = [];
const started = performance.now();

try {
	browser = await chromium.launch({
		executablePath: findChromium(),
		args: ["--no-sandbox"],
	});
	if (process.env.SITI_MEASURE_MENU) {
		console.log(
			"BENCH chromium.launch ms:",
			(performance.now() - started).toFixed(1),
		);
	}
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
	});
	await context.route("**/*", (route) =>
		new URL(route.request().url()).origin === url
			? route.continue()
			: route.abort(),
	);
	const page = await context.newPage();

	async function checkView(label) {
		const size = await page.evaluate(() => {
			const viewport = document.documentElement.clientWidth;
			const outside = [
				...document.querySelectorAll("#menu-catalog [data-search]"),
			]
				.filter((item) => item.getClientRects().length)
				.some((item) => {
					const box = item.getBoundingClientRect();
					return box.left < -1 || box.right > viewport + 1;
				});
			const rows = [
				...document.querySelectorAll("#menu-catalog [data-search]"),
			].filter((item) => item.getClientRects().length).length;
			return {
				viewport,
				scroll: document.documentElement.scrollWidth,
				outside,
				rows,
			};
		});
		if (process.env.SITI_MEASURE_MENU) console.log(label, JSON.stringify(size));
		if (size.scroll > size.viewport || size.outside)
			failures.push(
				label +
					": horizontal overflow (" +
					size.scroll +
					" > " +
					size.viewport +
					")",
			);
	}

	for (const path of ["/menu/", "/en/menu/"]) {
		const response = await page.goto(url + path, {
			waitUntil: "load",
			timeout: 10_000,
		});
		if (!response?.ok()) throw new Error(path + ": menu did not load");
		await page
			.locator("#menu-catalog")
			.waitFor({ state: "visible", timeout: 5000 });
		await page.evaluate(() => document.fonts.ready.then(() => undefined));
		await checkView(path + " initial");
		const buttons = page.locator("#menu-catalog [data-view-button]");
		for (const button of await buttons.all()) {
			const href = await button.getAttribute("href");
			if ((await button.getAttribute("aria-current")) !== "true") {
				await button.click({ timeout: 5000 });
			}
			const id = href?.slice(1);
			const visible = await page.evaluate((panelId) => {
				const panel = panelId ? document.getElementById(panelId) : null;
				return Boolean(
					panel?.getClientRects().length &&
						!panel.hasAttribute("data-view-inactive"),
				);
			}, id);
			if (!visible || (await button.getAttribute("aria-current")) !== "true") {
				failures.push(path + ": cannot show menu view " + href);
			}
			await checkView(path + " " + href);
		}
	}
	await context.close();
} finally {
	await browser?.close();
	await close();
}

if (failures.length) {
	console.error(failures.join("\n"));
	process.exitCode = 1;
}
