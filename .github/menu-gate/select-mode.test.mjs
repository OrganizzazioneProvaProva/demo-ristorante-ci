import assert from "node:assert/strict";
import { test } from "node:test";
import { selectMenuGate } from "./select-mode.mjs";

const trusted = { appActorId: "101", fullWorkflowId: "202" };
const repository = "OrganizzazioneProvaProva/demo-ristorante-ci";
const ref = "refs/heads/main";
const checkoutSha = "a".repeat(40);
const files = {
	"index.html": "home-it",
	"en/index.html": "home-en",
	"menu/index.html": "menu-it",
	"en/menu/index.html": "menu-en",
	"privacy/index.html": "privacy",
};

const example = {
	run: {
		eventName: "workflow_dispatch",
		repository,
		ref,
		attempt: 1,
		actorId: trusted.appActorId,
		checkoutSha,
		headSha: checkoutSha,
	},
	fullCheck: {
		workflowId: trusted.fullWorkflowId,
		repository,
		ref,
		headSha: checkoutSha,
		conclusion: "success",
		job: {
			name: "verify",
			conclusion: "success",
			steps: [
				"Build from Sanity and run the quick menu gate",
				"Run additional end-to-end checks on the same dist",
				"Run demo assertions and mutation tests on the same dist",
			].map((name) => ({ name, conclusion: "success" })),
		},
	},
	publication: {
		projectId: "l89w9ai1",
		dataset: "production",
		documentId: "menu",
		documentType: "menu",
		revision: "menu-rev-2",
	},
	published: {
		checkoutSha,
		documents: { menu: "menu-rev-1", home: "home-rev" },
		files,
	},
	candidate: {
		documents: { menu: "menu-rev-2", home: "home-rev" },
		files: {
			...files,
			"index.html": "new-home-it",
			"menu/index.html": "new-menu-it",
		},
	},
};

test("selects the quick gate for a verified update to the published menu", () => {
	assert.deepEqual(selectMenuGate(example, trusted), {
		mode: "quick",
		reason: "verified editorial menu update",
	});
});

test("falls back to the full suite when evidence is unavailable", () => {
	assert.equal(selectMenuGate().mode, "full");
});

test("a verification-only branch can have its own exact ref", () => {
	const data = structuredClone(example);
	const expectedRef = "refs/heads/ci/collaudo-evidenze-gate-menu";
	data.run.ref = expectedRef;
	data.fullCheck.ref = expectedRef;
	assert.equal(selectMenuGate(data, trusted).mode, "full");
	assert.equal(selectMenuGate(data, { ...trusted, expectedRef }).mode, "quick");
});

for (const [name, edit, reason] of [
	[
		"a dispatch by a person",
		(data) => {
			data.run.actorId = "999";
		},
		"unrecognized publisher",
	],
	[
		"a manual rerun of an App dispatch",
		(data) => {
			data.run.attempt = 2;
		},
		"unrecognized publisher",
	],
	[
		"a dispatch on another branch",
		(data) => {
			data.run.ref = "refs/heads/other";
		},
		"unrecognized publisher",
	],
	[
		"a full check on another commit",
		(data) => {
			data.fullCheck.headSha = "b".repeat(40);
		},
		"complete suite not verified for the checkout",
	],
	[
		"the checked-out commit differs from the requested commit",
		(data) => {
			data.run.headSha = "b".repeat(40);
		},
		"complete suite not verified for the checkout",
	],
	[
		"a green run of an unrelated workflow",
		(data) => {
			data.fullCheck.workflowId = "999";
		},
		"complete suite not verified for the checkout",
	],
	[
		"a green quick check with full tests skipped",
		(data) => {
			data.fullCheck.job.steps[1].conclusion = "skipped";
		},
		"complete suite not verified for the checkout",
	],
	[
		"the full-suite evidence is missing",
		(data) => {
			delete data.fullCheck;
		},
		"complete suite not verified for the checkout",
	],
	[
		"a different Sanity document",
		(data) => {
			data.publication.documentId = "home";
		},
		"unrecognized Sanity publication",
	],
	[
		"the publication lacks its revision",
		(data) => {
			delete data.publication.revision;
		},
		"unrecognized Sanity publication",
	],
	[
		"a new revision arrived before the build",
		(data) => {
			data.candidate.documents.menu = "menu-rev-3";
		},
		"built content differs from the menu publication",
	],
	[
		"another document changed in the build",
		(data) => {
			data.candidate.documents.home = "home-rev-2";
		},
		"built content differs from the menu publication",
	],
	[
		"an unrelated output changed",
		(data) => {
			data.candidate.files["privacy/index.html"] = "new-privacy";
		},
		"output changed outside the menu and home pages",
	],
	[
		"a new asset has no verified mapping to menu pages",
		(data) => {
			data.candidate.files["_astro/photo.webp"] = "added";
		},
		"output changed outside the menu and home pages",
	],
	[
		"a page expected from a menu update disappeared",
		(data) => {
			delete data.candidate.files["en/menu/index.html"];
		},
		"release or build inventory not verified",
	],
	[
		"the previous deployment used different code",
		(data) => {
			data.published.checkoutSha = "c".repeat(40);
		},
		"release or build inventory not verified",
	],
	[
		"the previous deployment is missing",
		(data) => {
			delete data.published;
		},
		"release or build inventory not verified",
	],
]) {
	test(`falls back to the full suite when ${name}`, () => {
		const data = structuredClone(example);
		edit(data);
		assert.deepEqual(selectMenuGate(data, trusted), { mode: "full", reason });
	});
}
