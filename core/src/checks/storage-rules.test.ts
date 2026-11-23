import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DECLARED_STORAGE, undeclaredStorage } from "./storage-rules.ts";

const empty = { cookies: [], localStorage: [], sessionStorage: [] };

describe("cookie e storage dichiarati", () => {
	it("il sito non dichiara nulla", () => {
		assert.deepEqual(DECLARED_STORAGE, empty);
	});

	it("niente nel browser: tutto in regola", () => {
		assert.deepEqual(undeclaredStorage(empty), []);
	});

	it("un cookie o una chiave di storage non dichiarati sono un problema (controllo negativo)", () => {
		assert.deepEqual(
			undeclaredStorage({
				cookies: ["_ga"],
				localStorage: ["tema"],
				sessionStorage: ["x"],
			}),
			["cookies: _ga", "localStorage: tema", "sessionStorage: x"],
		);
	});

	it("una voce dichiarata è ammessa", () => {
		const declared = { ...empty, cookies: ["sessione"] };
		assert.deepEqual(
			undeclaredStorage({ ...empty, cookies: ["sessione"] }, declared),
			[],
		);
		assert.deepEqual(
			undeclaredStorage({ ...empty, cookies: ["sessione", "altro"] }, declared),
			["cookies: altro"],
		);
	});
});
