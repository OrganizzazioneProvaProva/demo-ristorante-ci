import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { scanDirectory, scanSource } from "./static-rules.ts";

const rulesFor = (text: string, file = "Sezione.astro") =>
	scanSource(file, text).map((violation) => violation.rule);

describe("regole statiche dei componenti", () => {
	it("il codice di core/src non viola nessuna regola", () => {
		const root = fileURLToPath(new URL("..", import.meta.url));
		assert.deepEqual(scanDirectory(root), []);
	});

	it("set:html è vietato fuori dal componente JSON-LD e ammesso dentro", () => {
		const text = "<script set:html={json} />";
		assert.equal(rulesFor(text).length, 1);
		assert.deepEqual(rulesFor(text, "src/components/JsonLd.astro"), []);
	});

	it("vieta le varianti dark:", () => {
		assert.equal(rulesFor('<p class="bg-bg dark:bg-ink">').length, 1);
		assert.deepEqual(rulesFor('<p class="bg-bg">'), []);
	});

	it("vieta gli angoli fuori dal valore unico del DESIGN.md (rounded-ui), ammette cerchi e angoli vivi", () => {
		for (const bad of [
			"rounded",
			"rounded-lg",
			"rounded-md",
			"rounded-xl",
			"rounded-[8px]",
			"rounded-t-lg",
			"rounded-2xl",
		]) {
			assert.equal(rulesFor(`<a class="${bad} p-2">`).length, 1, bad);
		}
		for (const good of [
			"rounded-ui",
			"rounded-full",
			"rounded-none",
			"rounded-t-ui",
		]) {
			assert.deepEqual(rulesFor(`<a class="${good} p-2">`), [], good);
		}
	});

	it("vieta l'opacità sui ruoli ma non sui valori fuori dai ruoli", () => {
		assert.equal(rulesFor('<a class="bg-accent/80">').length, 1);
		assert.equal(rulesFor('<a class="text-ink/[0.6]">').length, 1);
		assert.equal(rulesFor('<a class="ring-accent/50">').length, 1);
		assert.deepEqual(
			rulesFor('<a class="bg-accent hover:bg-accent-hover">'),
			[],
		);
	});

	it("vieta outline-none e outline-hidden", () => {
		assert.equal(rulesFor('<a class="outline-none">').length, 1);
		assert.equal(rulesFor('<a class="focus:outline-hidden">').length, 1);
	});

	it("vieta i nomi dei token shadcn ma non i nostri ruoli", () => {
		for (const name of [
			"bg-background",
			"text-foreground",
			"bg-primary",
			"text-primary-foreground",
			"bg-destructive",
			"ring-ring",
			"text-muted-foreground",
			"border-input",
		]) {
			assert.equal(rulesFor(`<a class="${name}">`).length, 1, name);
		}
		for (const name of [
			"bg-bg",
			"text-ink",
			"text-muted",
			"border-line",
			"bg-pop",
			"text-accent-ink",
		]) {
			assert.deepEqual(rulesFor(`<a class="${name}">`), [], name);
		}
	});

	it("scansiona anche i commenti: Tailwind li legge e ne ricava classi", () => {
		assert.equal(rulesFor("// bg-accent/80 è vietato").length, 1);
		assert.equal(rulesFor("/* dark:bg-ink */").length, 1);
		assert.equal(rulesFor("<!-- outline-none -->").length, 1);
	});

	it("un /* dentro una stringa non nasconde le violazioni successive", () => {
		const text =
			'const f = import.meta.glob("./sezioni/*.astro");\nconst x = "outline-none";\n<div set:html={y} />';
		assert.equal(scanSource("A.astro", text).length, 2);
	});

	it("un // nel testo non nasconde le violazioni sulla stessa riga", () => {
		assert.equal(
			rulesFor('<p>Pranzo 12 // cena 19</p><a class="outline-none">').length,
			1,
		);
	});

	it("riconosce dark: dopo una graffa (template literal)", () => {
		assert.equal(
			rulesFor(["const c = `", "$", "{base}dark:bg-ink`;"].join("")).length,
			1,
		);
	});

	it("indica file e riga della violazione", () => {
		const [violation] = scanSource(
			"a/B.astro",
			'riga uno\n<a class="outline-none">',
		);
		assert.equal(violation?.file, "a/B.astro");
		assert.equal(violation?.line, 2);
	});
});
