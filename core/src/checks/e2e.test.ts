import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { listPages, runPool, serve, toHex } from "./e2e.ts";

function dist(files: Record<string, string>): string {
	const root = mkdtempSync(join(tmpdir(), "siti-e2e-"));
	for (const [name, content] of Object.entries(files)) {
		mkdirSync(join(root, name, ".."), { recursive: true });
		writeFileSync(join(root, name), content);
	}
	return root;
}

/** GET con l'URL scritto esattamente così (il client `fetch` lo normalizzerebbe). */
function get(
	base: string,
	path: string,
): Promise<{ status: number; body: string }> {
	const { hostname, port } = new URL(base);
	return new Promise((resolve, reject) => {
		const req = request({ hostname, port, path, method: "GET" }, (res) => {
			let body = "";
			res.on("data", (chunk) => {
				body += chunk;
			});
			res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
		});
		req.on("error", reject);
		req.end();
	});
}

describe("listPages", () => {
	it("elenca index.html con la barra finale, le altre pagine .html e salta _astro", () => {
		const root = dist({
			"index.html": "",
			"en/index.html": "",
			"chi-siamo/index.html": "",
			"404.html": "",
			"_astro/frammento.html": "",
			"altro-index.html": "",
		});
		assert.deepEqual(listPages(root), [
			"/",
			"/404.html",
			"/altro-index.html",
			"/chi-siamo/",
			"/en/",
		]);
	});
});

describe("toHex", () => {
	it("scrive i canali con due cifre e arrotonda", () => {
		assert.equal(toHex([0, 15.4, 255]), "#000fff");
	});
});

describe("serve", () => {
	it("serve le pagine, risponde 404 ai file assenti e 400 agli indirizzi malformati senza cadere", async () => {
		const root = dist({
			"index.html": "<h1>ciao</h1>",
			"en/index.html": "<h1>hi</h1>",
		});
		const server = await serve(root);
		try {
			assert.equal((await get(server.url, "/")).body, "<h1>ciao</h1>");
			assert.equal((await get(server.url, "/en/")).body, "<h1>hi</h1>");
			assert.equal((await get(server.url, "/non-esiste.html")).status, 404);
			assert.equal((await get(server.url, "/%E0%A4%A")).status, 400);
			assert.equal((await get(server.url, "/%00")).status, 400);
			// il server è ancora vivo dopo l'indirizzo malformato
			assert.equal((await get(server.url, "/")).status, 200);
		} finally {
			await server.close();
		}
	});

	it("non esce dalla cartella di build (path traversal)", async () => {
		const root = dist({ "index.html": "x" });
		const server = await serve(root);
		try {
			for (const path of [
				"/..%2f..%2fpackage.json",
				"/%2e%2e/%2e%2e/etc/passwd",
				"/../../etc/passwd",
			]) {
				const { status } = await get(server.url, path);
				assert.ok(status === 403 || status === 404, `${path} → ${status}`);
			}
		} finally {
			await server.close();
		}
	});

	it("per le risorse mancanti serve con stato 404 la pagina più vicina", async () => {
		const root = dist({
			"index.html": "home IT",
			"en/index.html": "home EN",
			"404.html": "404 IT",
			"en/404.html": "404 EN",
			"en/area/404.html": "404 area",
		});
		const server = await serve(root);
		try {
			for (const [path, body] of [
				["/mancante", "404 IT"],
				["/altro/cartella/assente/", "404 IT"],
				["/en/missing", "404 EN"],
				["/en/missing/deeper/?a=1", "404 EN"],
				["/en/area/deep/missing", "404 area"],
			])
				assert.deepEqual(
					await get(server.url, path),
					{ status: 404, body },
					path,
				);
			assert.deepEqual(await get(server.url, "/en/"), {
				status: 200,
				body: "home EN",
			});
		} finally {
			await server.close();
		}
	});

	it("blocca i symlink esterni nei file, negli index e nelle pagine 404", async (t) => {
		const root = dist({ "index.html": "interno", "area/.keep": "" });
		const outside = dist({ "index.html": "marcatore esterno" });
		t.after(() => {
			rmSync(root, { recursive: true });
			rmSync(outside, { recursive: true });
		});
		const externalFile = join(outside, "index.html");
		symlinkSync(externalFile, join(root, "esterno.html"));
		symlinkSync(outside, join(root, "cartella-esterna"), "dir");
		symlinkSync(externalFile, join(root, "area", "index.html"));
		symlinkSync(externalFile, join(root, "area", "404.html"));
		symlinkSync("index.html", join(root, "interno.html"));
		const server = await serve(root);
		try {
			for (const href of [
				"/esterno.html",
				"/cartella-esterna/",
				"/cartella-esterna/assente",
				"/area/",
				"/area/mancante",
			]) {
				await t.test(href, async () => {
					assert.deepEqual(await get(server.url, href), {
						status: 403,
						body: "",
					});
				});
			}
			assert.deepEqual(await get(server.url, "/interno.html"), {
				status: 200,
				body: "interno",
			});
		} finally {
			await server.close();
		}
	});

	it("ignora un _headers collegato a un file esterno", async (t) => {
		const root = dist({ "index.html": "interno" });
		const outside = dist({ _headers: "/*\n  X-Siti-Fixture: esterno\n" });
		t.after(() => {
			rmSync(root, { recursive: true });
			rmSync(outside, { recursive: true });
		});
		symlinkSync(join(outside, "_headers"), join(root, "_headers"));
		const server = await serve(root);
		try {
			const response = await fetch(server.url);
			assert.equal(await response.text(), "interno");
			assert.equal(response.headers.get("x-siti-fixture"), null);
			assert.equal((await get(server.url, "/_headers")).status, 403);
		} finally {
			await server.close();
		}
	});
});

describe("runPool", () => {
	it("esegue tutti i lavori, mai più di `size` insieme", async () => {
		let running = 0;
		let peak = 0;
		const done: number[] = [];
		await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
			running++;
			peak = Math.max(peak, running);
			await new Promise((resolve) => setTimeout(resolve, 5));
			done.push(n);
			running--;
		});
		assert.deepEqual(done.sort(), [1, 2, 3, 4, 5, 6, 7]);
		assert.ok(peak <= 3 && peak >= 2, `picco ${peak}`);
	});

	it("un lavoro che fallisce fa fallire il tutto", async () => {
		await assert.rejects(
			runPool([1, 2, 3], 2, async (n) => {
				if (n === 2) throw new Error("rotto");
			}),
			/rotto/,
		);
	});

	it("con nessun lavoro non fa nulla", async () => {
		await runPool([], 4, async () => {
			throw new Error("non deve partire");
		});
	});
});
