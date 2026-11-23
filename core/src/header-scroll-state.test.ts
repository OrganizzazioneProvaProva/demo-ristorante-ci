import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	type HeaderScrollState,
	nextHeaderScrollState,
} from "./header-scroll-state.ts";

const limits = { maxY: 2000, headerHeight: 64 };
const run = (
	positions: number[],
	start: HeaderScrollState = { hidden: false, anchor: 0 },
) =>
	positions.reduce(
		(state, y) => nextHeaderScrollState(state, y, limits),
		start,
	);

describe("nextHeaderScrollState", () => {
	it("in cima alla pagina (sotto l'altezza dell'intestazione) è sempre visibile", () => {
		assert.equal(run([10, 40, 64]).hidden, false);
		assert.equal(run([500, 30]).hidden, false);
	});

	it("scorrendo in basso oltre la soglia si nasconde", () => {
		assert.equal(run([100, 150, 200]).hidden, true);
	});

	it("spostamenti piccoli (sotto la soglia) non la nascondono", () => {
		// l'utente è già a 100 px (stato iniziale con anchor 100): +8 in totale non basta
		assert.equal(
			run([103, 106, 108], { hidden: false, anchor: 100 }).hidden,
			false,
		);
		assert.equal(
			run([103, 106, 109], { hidden: false, anchor: 100 }).hidden,
			true,
		);
	});

	it("risalendo oltre la soglia ricompare", () => {
		assert.equal(run([100, 300, 500, 480]).hidden, false);
		assert.equal(run([100, 300, 500, 495]).hidden, true);
	});

	it("un piccolo rimbalzo verso l'alto mentre scorre in basso non la fa ricomparire", () => {
		assert.equal(run([200, 400, 600, 596, 700]).hidden, true);
	});

	it("la direzione si misura dall'ultimo estremo, non dall'ultimo passo", () => {
		// sale di 5 + 5 + 5 = 15 px a piccoli passi: ricompare perché il totale supera la soglia
		assert.equal(run([200, 400, 600, 595, 590, 585]).hidden, false);
	});

	it("il rimbalzo oltre la fine della pagina viene limitato e non inverte la direzione", () => {
		const state = run([1990, 2000]);
		assert.equal(
			nextHeaderScrollState(state, 2040, limits).hidden,
			state.hidden,
		);
		assert.equal(nextHeaderScrollState(state, 2040, limits).anchor, 2000);
	});

	it("un valore di scroll negativo (rimbalzo in cima) è trattato come 0", () => {
		assert.deepEqual(
			nextHeaderScrollState({ hidden: true, anchor: 300 }, -30, limits),
			{
				hidden: false,
				anchor: 0,
			},
		);
	});

	it("una pagina più corta della finestra (maxY 0) non la nasconde mai", () => {
		const short = { maxY: 0, headerHeight: 64 };
		assert.equal(
			nextHeaderScrollState({ hidden: false, anchor: 0 }, 300, short).hidden,
			false,
		);
	});
});
