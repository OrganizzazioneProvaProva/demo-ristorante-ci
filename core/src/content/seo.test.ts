import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { documentTitle, FAVICON_PATH, monogramSvg, OG_LOCALES } from "./seo.ts";

const company = {
	name: "Ristorante X",
	address: { city: "Piazza Armerina" },
} as never;

describe("titolo del documento", () => {
	it("Pagina · Attività · Città", () => {
		assert.equal(
			documentTitle("Menu", company),
			"Menu · Ristorante X · Piazza Armerina",
		);
	});

	it("non ripete le parti uguali (la home ha il nome dell'attività come titolo)", () => {
		assert.equal(
			documentTitle("Ristorante X", company),
			"Ristorante X · Piazza Armerina",
		);
		assert.equal(
			documentTitle("ristorante x", company),
			"ristorante x · Piazza Armerina",
		);
	});
});

describe("monogramma", () => {
	it("usa l'iniziale in maiuscolo e i colori del tema", () => {
		const svg = monogramSvg({
			name: "  pizzeria da Mario",
			background: "#1D5FBF",
			foreground: "#FFFFFF",
		});
		assert.match(svg, />P<\/text>/);
		assert.match(svg, /fill="#1D5FBF"/);
		assert.match(svg, /fill="#FFFFFF"/);
	});

	it("salta i caratteri che non sono lettere e protegge i simboli XML", () => {
		const svg = monogramSvg({
			name: "& Co",
			background: "#000000",
			foreground: "#ffffff",
		});
		assert.match(svg, />C<\/text>/);
		assert.equal(svg.includes("&amp;"), false);
		assert.match(
			monogramSvg({
				name: "123",
				background: "#000000",
				foreground: "#ffffff",
			}),
			/>•<\/text>/,
		);
	});

	it("colori che non sono #rrggbb fermano la build", () => {
		assert.throws(
			() =>
				monogramSvg({ name: "A", background: "red", foreground: "#ffffff" }),
			/#rrggbb/,
		);
	});

	it("percorso e lingue OG fissi", () => {
		assert.equal(FAVICON_PATH, "/favicon.svg");
		assert.equal(OG_LOCALES.it, "it_IT");
	});
});
