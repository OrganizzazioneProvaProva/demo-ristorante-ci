const repository = "OrganizzazioneProvaProva/demo-ristorante-ci";
const main = "refs/heads/main";
const affectedFiles = new Set([
	"index.html",
	"en/index.html",
	"menu/index.html",
	"en/menu/index.html",
]);
const requiredSteps = [
	"Build from Sanity and run the quick menu gate",
	"Run additional end-to-end checks on the same dist",
	"Run demo assertions and mutation tests on the same dist",
];

function validInventory(inventory) {
	return (
		inventory &&
		typeof inventory === "object" &&
		!Array.isArray(inventory) &&
		Object.entries(inventory).every(
			([key, value]) => key && typeof value === "string" && value,
		)
	);
}

function changedKeys(before, after) {
	const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
	return [...keys].filter(
		(key) =>
			!Object.hasOwn(before, key) ||
			!Object.hasOwn(after, key) ||
			before[key] !== after[key],
	);
}

const full = (reason) => ({ mode: "full", reason });

/**
 * The caller supplies normalized evidence from GitHub, the authenticated webhook
 * and the actual build and deployment. Workflow inputs cannot supply this evidence.
 */
export function selectMenuGate(
	{ run, fullCheck, publication, published, candidate } = {},
	{ appActorId, fullWorkflowId, expectedRef = main } = {},
) {
	if (
		run?.eventName !== "workflow_dispatch" ||
		run.repository !== repository ||
		run.ref !== expectedRef ||
		run.attempt !== 1 ||
		!appActorId ||
		run.actorId !== appActorId
	) {
		return full("unrecognized publisher");
	}

	const checkoutSha = run.checkoutSha;
	if (
		!fullWorkflowId ||
		typeof checkoutSha !== "string" ||
		!/^[0-9a-f]{40}$/.test(checkoutSha) ||
		run.headSha !== checkoutSha ||
		fullCheck?.workflowId !== fullWorkflowId ||
		fullCheck.repository !== repository ||
		fullCheck.ref !== expectedRef ||
		fullCheck.headSha !== checkoutSha ||
		fullCheck.conclusion !== "success" ||
		fullCheck.job?.name !== "verify" ||
		fullCheck.job.conclusion !== "success" ||
		!Array.isArray(fullCheck.job.steps) ||
		!requiredSteps.every((name) =>
			fullCheck.job.steps.some(
				(step) => step?.name === name && step.conclusion === "success",
			),
		)
	) {
		return full("complete suite not verified for the checkout");
	}

	if (
		publication?.projectId !== "l89w9ai1" ||
		publication.dataset !== "production" ||
		publication.documentId !== "menu" ||
		publication.documentType !== "menu" ||
		typeof publication.revision !== "string" ||
		!publication.revision
	) {
		return full("unrecognized Sanity publication");
	}

	if (
		published?.checkoutSha !== checkoutSha ||
		!validInventory(published.documents) ||
		!validInventory(candidate?.documents) ||
		!validInventory(published.files) ||
		!validInventory(candidate.files) ||
		![...affectedFiles].every(
			(file) =>
				Object.hasOwn(published.files, file) &&
				Object.hasOwn(candidate.files, file),
		)
	) {
		return full("release or build inventory not verified");
	}

	const changedDocuments = changedKeys(
		published.documents,
		candidate.documents,
	);
	if (
		!Object.hasOwn(candidate.documents, "menu") ||
		candidate.documents.menu !== publication.revision ||
		changedDocuments.length !== 1 ||
		changedDocuments[0] !== "menu"
	) {
		return full("built content differs from the menu publication");
	}

	if (
		changedKeys(published.files, candidate.files).some(
			(file) => !affectedFiles.has(file),
		)
	) {
		return full("output changed outside the menu and home pages");
	}

	return { mode: "quick", reason: "verified editorial menu update" };
}
