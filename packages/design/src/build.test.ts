import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { writeThemeCss } from "./build.ts";

const designMd = readFileSync(
	new URL("../../../preset/ristorante/design/maiolica.md", import.meta.url),
	"utf8",
);

describe("writeThemeCss", () => {
	it("scrive il CSS anche in una cartella con spazi, con percorsi URL", () => {
		const root = mkdtempSync(join(tmpdir(), "siti design "));
		const source = join(root, "sito uno", "DESIGN.md");
		mkdirSync(join(root, "sito uno"), { recursive: true });
		writeFileSync(source, designMd);
		const target = join(root, "sito uno", "src", "styles", "theme.css");
		writeThemeCss(pathToFileURL(source), pathToFileURL(target));
		assert.match(readFileSync(target, "utf8"), /--t-bg:/);
	});

	it("con un percorso testuale crea le cartelle mancanti", () => {
		const root = mkdtempSync(join(tmpdir(), "siti-design-"));
		const source = join(root, "DESIGN.md");
		writeFileSync(source, designMd);
		const target = join(root, "a", "b", "theme.css");
		writeThemeCss(source, target);
		assert.match(readFileSync(target, "utf8"), /--t-accent:/);
	});

	it("un DESIGN.md non valido lancia e non scrive nulla", () => {
		const root = mkdtempSync(join(tmpdir(), "siti-design-"));
		const source = join(root, "DESIGN.md");
		writeFileSync(
			source,
			designMd.replace(/ink: "#[0-9A-Fa-f]{6}"/, 'ink: "#FFFFFF"'),
		);
		const target = join(root, "out.css");
		assert.throws(() => writeThemeCss(source, target));
		assert.throws(() => readFileSync(target, "utf8"), /ENOENT/);
	});
});
