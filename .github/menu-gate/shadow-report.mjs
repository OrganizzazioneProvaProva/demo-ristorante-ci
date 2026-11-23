import { readFileSync } from "node:fs";
import { selectMenuGate } from "./select-mode.mjs";

const expectedRef = "refs/heads/ci/collaudo-evidenze-gate-menu";
const workflowPath = ".github/workflows/build-demo-ristorante.yml";
const trusted = {
	appActorId: "360248634",
	fullWorkflowId: "427760882",
	expectedRef,
};

export function evaluateShadow({
	run,
	baseline,
	jobs,
	published,
	candidate,
	revision,
}) {
	const fullCheck =
		baseline?.event === "push" &&
		baseline.status === "completed" &&
		baseline.path === workflowPath &&
		baseline.head_repository?.full_name === run.repository &&
		typeof baseline.head_branch === "string"
			? {
					workflowId: String(baseline.workflow_id),
					repository: baseline.repository?.full_name,
					ref: `refs/heads/${baseline.head_branch}`,
					headSha: baseline.head_sha,
					conclusion: baseline.conclusion,
					job: jobs?.find(
						(job) =>
							job?.name === "verify" &&
							job.run_id === baseline.id &&
							job.run_attempt === baseline.run_attempt,
					),
				}
			: undefined;

	return selectMenuGate(
		{
			run,
			fullCheck,
			publication: {
				projectId: "l89w9ai1",
				dataset: "production",
				documentId: "menu",
				documentType: "menu",
				revision,
			},
			published:
				published?.projectId === "l89w9ai1" &&
				published.dataset === "production" &&
				published.schemaVersion === 1
					? published
					: undefined,
			candidate:
				candidate?.projectId === "l89w9ai1" &&
				candidate.dataset === "production" &&
				candidate.schemaVersion === 1 &&
				candidate.checkoutSha === run.checkoutSha
					? candidate
					: undefined,
		},
		trusted,
	);
}

if (import.meta.main) {
	const [directory, checkoutSha] = process.argv.slice(2);
	const json = (file) =>
		JSON.parse(readFileSync(`${directory}/${file}`, "utf8"));
	let decision;
	try {
		decision = evaluateShadow({
			run: {
				eventName: process.env.GITHUB_EVENT_NAME,
				repository: process.env.GITHUB_REPOSITORY,
				ref: process.env.GITHUB_REF,
				attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
				actorId: process.env.GITHUB_ACTOR_ID,
				headSha: process.env.GITHUB_SHA,
				checkoutSha,
			},
			baseline: json("reference-run.json"),
			jobs: json("reference-jobs.json").jobs,
			published: json("reference/menu-build-evidence.json"),
			candidate: json("menu-build-evidence.json"),
			revision: process.env.SITI_SANITY_MENU_REVISION,
		});
	} catch {
		decision = {
			mode: "full",
			reason: "verification evidence could not be read",
		};
	}
	console.log(`Menu gate would select ${decision.mode}: ${decision.reason}`);
	console.log(
		"Verification run: executing the full suite regardless of the selection.",
	);
}
