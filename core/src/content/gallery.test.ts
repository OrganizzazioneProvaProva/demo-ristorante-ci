import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSiteConfig } from "@siti/config";
import { rawGallerySchema, resolveGallery } from "./gallery.ts";

const config = parseSiteConfig({
	slug: "t",
	schemaVersion: 1,
	languages: ["it", "en"],
});
const url = (n: number, ext = "jpg") =>
	`https://cdn.sanity.io/images/a9fpp237/production/img${n}-800x600.${ext}`;

const gallery = {
	images: [
		{ asset: { url: url(1) }, decorative: true },
		{
			asset: { url: url(2) },
			alt: { it: "Il forno a legna", en: "The wood-fired oven" },
		},
		{ asset: { url: url(3) }, alt: { it: "La sala" } },
		{
			asset: { url: url(4) },
			alt: { it: "Il menu del giorno" },
			informative: true,
		},
	],
};

describe("galleria", () => {
	it("in italiano mostra tutte le immagini nell'ordine dello Studio", () => {
		const { images, skipped } = resolveGallery(gallery, "it", config);
		assert.deepEqual(
			images.map((i) => i.alt),
			["", "Il forno a legna", "La sala", "Il menu del giorno"],
		);
		assert.equal(skipped, 0);
	});

	it("in inglese: alt italiano con lang=it per le foto non informative, saltate le informative", () => {
		const { images, skipped } = resolveGallery(gallery, "en", config);
		assert.deepEqual(
			images.map((i) => [i.alt, i.lang]),
			[
				["", undefined],
				["The wood-fired oven", undefined],
				["La sala", "it"],
			],
		);
		assert.equal(skipped, 1);
	});

	it("se tutte le immagini sono informative e senza alt inglese, in inglese la galleria è vuota", () => {
		const only = {
			images: [
				{ asset: { url: url(1) }, alt: { it: "Menu" }, informative: true },
			],
		};
		assert.deepEqual(resolveGallery(only, "en", config), {
			images: [],
			skipped: 1,
		});
	});

	it("senza testo alternativo italiano (e non decorativa) la build si ferma", () => {
		const bad = { images: [{ asset: { url: url(1) } }] };
		assert.throws(() => resolveGallery(bad, "it", config), /testo alternativo/);
	});

	it("rifiuta una galleria vuota, con più di 30 immagini o con un formato non ammesso", () => {
		assert.ok(!rawGallerySchema.safeParse({ images: [] }).success);
		const many = Array.from({ length: 31 }, (_, i) => ({
			asset: { url: url(i) },
			decorative: true,
		}));
		assert.ok(!rawGallerySchema.safeParse({ images: many }).success);
		assert.ok(
			!rawGallerySchema.safeParse({
				images: [{ asset: { url: url(1, "svg") } }],
			}).success,
		);
	});
});
