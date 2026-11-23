import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import {
	rawImageSchema,
	requireDimensions,
	resolveImage,
	resolveLocalImage,
} from "./images.ts";

const config = parseSiteConfig({
	slug: "t",
	schemaVersion: 1,
	languages: ["it", "en"],
});
const url =
	"https://cdn.sanity.io/images/a9fpp237/production/abc123-800x600.jpg";
const image = (extra: object = {}) =>
	rawImageSchema.parse({ asset: { url, width: 800, height: 600 }, ...extra });

describe("immagini", () => {
	it("accetta solo il CDN di Sanity e solo JPEG, PNG, WebP, AVIF", () => {
		for (const ok of ["jpg", "jpeg", "png", "webp", "avif"]) {
			const u = `https://cdn.sanity.io/images/a9fpp237/production/x-10x10.${ok}`;
			assert.ok(rawImageSchema.safeParse({ asset: { url: u } }).success, ok);
		}
		for (const ko of [
			"https://cdn.sanity.io/images/a9fpp237/production/x-10x10.svg",
			"https://altrosito.example/images/a9fpp237/production/x-10x10.jpg",
			"http://cdn.sanity.io/images/a9fpp237/production/x-10x10.jpg",
			"https://cdn.sanity.io/images/a9fpp237/production/x-10x10.jpg?w=100",
		]) {
			assert.ok(!rawImageSchema.safeParse({ asset: { url: ko } }).success, ko);
		}
	});

	it("un'immagine decorativa ha alt vuoto, in ogni lingua", () => {
		assert.equal(
			resolveImage(image({ decorative: true }), "it", config)?.alt,
			"",
		);
		assert.equal(
			resolveImage(image({ decorative: true }), "en", config)?.alt,
			"",
		);
	});

	it("usa il testo alternativo nella lingua richiesta e passa le dimensioni", () => {
		const raw = image({ alt: { it: "Una pizza", en: "A pizza" } });
		const it = resolveImage(raw, "it", config);
		assert.deepEqual(it, { url, width: 800, height: 600, alt: "Una pizza" });
		assert.equal(resolveImage(raw, "en", config)?.alt, "A pizza");
	});

	it("senza alt italiano (lingua principale) la build si ferma", () => {
		assert.throws(
			() => resolveImage(image({ alt: { en: "A pizza" } }), "it", config),
			/lingua principale/,
		);
		assert.throws(
			() => resolveImage(image(), "it", config),
			/testo alternativo/,
		);
	});

	it("senza alt inglese una foto non informativa usa l'alt italiano con lang=it", () => {
		assert.deepEqual(
			resolveImage(image({ alt: { it: "Una pizza" } }), "en", config),
			{ url, width: 800, height: 600, alt: "Una pizza", lang: "it" },
		);
	});

	it("senza alt inglese un'immagine informativa non si mostra in inglese", () => {
		assert.equal(
			resolveImage(
				image({ alt: { it: "Il menu del giorno" }, informative: true }),
				"en",
				config,
			),
			undefined,
		);
		// in italiano, invece, si mostra
		assert.equal(
			resolveImage(
				image({ alt: { it: "Il menu del giorno" }, informative: true }),
				"it",
				config,
			)?.alt,
			"Il menu del giorno",
		);
	});

	it("senza alcun alt e non decorativa la build si ferma anche in inglese", () => {
		assert.throws(
			() => resolveImage(image(), "en", config),
			/lingua principale/,
		);
	});

	it("con alt inglese presente non c'è lang", () => {
		const r = resolveImage(
			image({ alt: { it: "Una", en: "A" } }),
			"en",
			config,
		);
		assert.equal(r?.lang, undefined);
	});

	it("una decorativa informativa resta alt vuoto", () => {
		assert.equal(
			resolveImage(image({ decorative: true, informative: true }), "en", config)
				?.alt,
			"",
		);
	});
});

describe("segnaposto locali (resolveLocalImage)", () => {
	const src = {
		src: "/_astro/hero.abc.svg",
		width: 1600,
		height: 900,
		format: "svg" as const,
	};
	const local = (extra: object = {}) => ({
		src,
		placeholder: true,
		alt: { it: "Sala del ristorante" },
		...extra,
	});

	it("passa dalle stesse regole di alt: con alt italiano in italiano non c'è lang", () => {
		const resolved = resolveLocalImage(local(), "it", config);
		assert.equal(resolved?.alt, "Sala del ristorante");
		assert.equal(resolved?.lang, undefined);
		assert.deepEqual(resolved?.local, src);
		assert.equal(resolved?.width, 1600);
	});

	it("senza alt inglese una foto non informativa usa l'alt italiano con lang=it", () => {
		const resolved = resolveLocalImage(local(), "en", config);
		assert.equal(resolved?.alt, "Sala del ristorante");
		assert.equal(resolved?.lang, "it");
	});

	it("senza alt inglese un segnaposto informativo non si mostra in inglese", () => {
		assert.equal(
			resolveLocalImage(local({ informative: true }), "en", config),
			undefined,
		);
	});

	it("senza alt italiano e non decorativo la build si ferma", () => {
		assert.throws(
			() => resolveLocalImage({ src, placeholder: true }, "it", config),
			/manca il testo alternativo in it/,
		);
	});

	it("un segnaposto decorativo ha alt vuoto", () => {
		assert.equal(
			resolveLocalImage(
				{ src, decorative: true, placeholder: true },
				"en",
				config,
			)?.alt,
			"",
		);
	});

	it("accetta anche un import SVG, che è una funzione con le stesse proprietà", () => {
		const svg = Object.assign(() => "<svg/>", src);
		assert.equal(
			resolveLocalImage(
				{ src: svg, alt: { it: "x" }, placeholder: true },
				"it",
				config,
			)?.width,
			1600,
		);
	});

	it("il flag placeholder passa al risultato: vero per un segnaposto, falso per il logo", () => {
		assert.equal(resolveLocalImage(local(), "it", config)?.placeholder, true);
		assert.equal(
			resolveLocalImage(local({ placeholder: false }), "it", config)
				?.placeholder,
			false,
		);
	});

	it("senza il flag placeholder la build si ferma (la scelta è esplicita)", () => {
		assert.throws(() =>
			resolveLocalImage({ src, alt: { it: "x" } } as never, "it", config),
		);
	});

	it("rifiuta un oggetto che non è un'immagine importata (senza dimensioni)", () => {
		assert.throws(() =>
			resolveLocalImage(
				{
					src: { src: "/x.svg" } as never,
					alt: { it: "x" },
					placeholder: true,
				},
				"it",
				config,
			),
		);
	});
});

describe("requireDimensions (foto remote)", () => {
	it("restituisce larghezza e altezza quando ci sono", () => {
		const resolved = resolveImage(image({ alt: { it: "Sala" } }), "it", config);
		assert.deepEqual(requireDimensions(resolved as never), {
			width: 800,
			height: 600,
		});
	});

	it("ferma la build se la query non ha restituito le dimensioni", () => {
		const raw = rawImageSchema.parse({ asset: { url }, alt: { it: "Sala" } });
		const resolved = resolveImage(raw, "it", config);
		assert.throws(
			() => requireDimensions(resolved as never),
			/mancano larghezza e altezza/,
		);
	});
});
