import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateShadow } from "./shadow-report.mjs";

const repository = "OrganizzazioneProvaProva/demo-ristorante-ci";
const branch = "ci/collaudo-evidenze-gate-menu";
const checkoutSha = "a".repeat(40);
const files = {
	"index.html": "home-it",
	"en/index.html": "home-en",
	"menu/index.html": "menu-it",
	"en/menu/index.html": "menu-en",
};
const published = {
	schemaVersion: 1,
	checkoutSha,
	projectId: "l89w9ai1",
	dataset: "production",
	documents: { menu: "menu-before", home: "home-1" },
	files,
};
const evidence = {
	run: {
		eventName: "workflow_dispatch",
		repository,
		ref: `refs/heads/${branch}`,
		attempt: 1,
		actorId: "360248634",
		headSha: checkoutSha,
		checkoutSha,
	},
	baseline: {
		id: 42,
		run_attempt: 1,
		event: "push",
		status: "completed",
		path: ".github/workflows/build-demo-ristorante.yml",
		head_repository: { full_name: repository },
		repository: { full_name: repository },
		head_branch: branch,
		head_sha: checkoutSha,
		workflow_id: 427760882,
		conclusion: "success",
	},
	jobs: [
		{
			name: "verify",
			run_id: 42,
			run_attempt: 1,
			conclusion: "success",
			steps: [
				"Build from Sanity and run the quick menu gate",
				"Run additional end-to-end checks on the same dist",
				"Run demo assertions and mutation tests on the same dist",
			].map((name) => ({ name, conclusion: "success" })),
		},
	],
	published,
	candidate: {
		...published,
		documents: { ...published.documents, menu: "menu-after" },
		files: { ...files, "menu/index.html": "changed-menu" },
	},
	revision: "menu-after",
};

test("reports quick when the read-only reference and revision match", () => {
	assert.equal(evaluateShadow(evidence).mode, "quick");
});

test("reports full when the comparison came from another attempt", () => {
	const input = structuredClone(evidence);
	input.jobs[0].run_attempt = 2;
	assert.equal(evaluateShadow(input).mode, "full");
});

test("reports full for another dataset or a different checkout", () => {
	const input = structuredClone(evidence);
	input.candidate.dataset = "staging";
	assert.equal(evaluateShadow(input).mode, "full");
	input.candidate = { ...evidence.candidate, checkoutSha: "b".repeat(40) };
	assert.equal(evaluateShadow(input).mode, "full");
});
