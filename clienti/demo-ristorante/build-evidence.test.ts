import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
	buildEvidence,
	collectDocumentRevisions,
	fingerprintDist,
} from "./build-evidence.ts";

test("collects the top-level documents already loaded for the build", () => {
	const menu = {
		_id: "menu",
		_rev: "menu-1",
		image: { _id: "image", _rev: "image-1" },
	};
	assert.deepEqual(
		collectDocumentRevisions({
			menu,
			contacts: null,
			promotions: [],
			pages: [menu, { _id: "home", _rev: "home-1" }],
		}),
		{ home: "home-1", menu: "menu-1" },
	);
});

test("rejects incomplete or inconsistent document revisions", () => {
	assert.throws(
		() => collectDocumentRevisions({ menu: { _id: "menu" } }),
		/senza ID o revisione/,
	);
	assert.throws(
		() =>
			collectDocumentRevisions({
				menu: { _id: "menu", _rev: "menu-1" },
				other: [{ _id: "menu", _rev: "menu-2" }],
			}),
		/Revisioni diverse/,
	);
});

test("attaches the exact checkout and fingerprints nested HTML and assets", (context) => {
	const dist = mkdtempSync(join(tmpdir(), "siti-evidence-test-"));
	context.after(() => rmSync(dist, { recursive: true, force: true }));
	mkdirSync(join(dist, "en/menu"), { recursive: true });
	writeFileSync(join(dist, "en/menu/index.html"), "first menu");
	writeFileSync(join(dist, "robots.txt"), "robots");
	const snapshot = {
		projectId: "test-project",
		dataset: "production",
		documents: { menu: "menu-1" },
	};
	const first = buildEvidence(snapshot, dist, "a".repeat(40));
	assert.equal(first.checkoutSha, "a".repeat(40));
	assert.deepEqual(first.documents, snapshot.documents);
	assert.deepEqual(Object.keys(first.files), [
		"en/menu/index.html",
		"robots.txt",
	]);
	assert.match(first.files["en/menu/index.html"] ?? "", /^[0-9a-f]{64}$/);
	writeFileSync(join(dist, "en/menu/index.html"), "changed menu");
	const second = fingerprintDist(dist);
	assert.notEqual(
		first.files["en/menu/index.html"],
		second["en/menu/index.html"],
	);
	assert.equal(first.files["robots.txt"], second["robots.txt"]);
	assert.throws(() => buildEvidence(snapshot, dist, "abc"), /SHA completo/);
});

test("rejects an empty or symlinked inventory", (context) => {
	const dist = mkdtempSync(join(tmpdir(), "siti-evidence-test-"));
	context.after(() => rmSync(dist, { recursive: true, force: true }));
	assert.throws(() => fingerprintDist(dist), /dist è vuoto/);
	symlinkSync("missing", join(dist, "link.html"));
	assert.throws(() => fingerprintDist(dist), /diverso da un file/);
});
