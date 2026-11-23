import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const [mode] = process.argv.slice(2);
if (!["quick", "full"].includes(mode))
	throw new Error("Expected quick or full");

const site = fileURLToPath(new URL(".", import.meta.url));
const temporaryRoot = realpathSync(tmpdir());
const pathFromSite = relative(site, temporaryRoot);
if (
	!pathFromSite ||
	(!isAbsolute(pathFromSite) &&
		pathFromSite !== ".." &&
		!pathFromSite.startsWith(".." + sep))
) {
	throw new Error(
		"The menu snapshot requires a temporary directory outside the site",
	);
}
const directory = mkdtempSync(join(temporaryRoot, "siti-menu-"));
const snapshot = resolve(directory, "menu.json");

function run(executable, args, env = process.env) {
	const result = spawnSync(executable, args, {
		cwd: site,
		env,
		stdio: "inherit",
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		process.exitCode = result.status ?? 1;
		return false;
	}
	return true;
}

const node = (args, env) => run(process.execPath, args, env);

try {
	const commonPassed =
		node(["../../core/src/checks/run-static-rules.ts", "src"]) &&
		run("pnpm", ["run", "build"], {
			...process.env,
			SITI_MENU_SNAPSHOT_PATH: snapshot,
		}) &&
		node([
			"../../core/src/checks/run-check-site.ts",
			"--probe",
			"node_modules/@siti/preset-ristorante/src/probe.ts",
		]) &&
		node(["check-menu-content.mjs", snapshot]) &&
		node(["check-menu-browser.mjs"]);
	if (
		commonPassed &&
		mode === "full" &&
		node(["../../core/src/checks/run-e2e.ts"])
	) {
		const editorial = process.env.SITI_CONTENT?.trim() === "sanity";
		node(
			editorial ? ["check-demo.mjs", "--editorial-menu"] : ["check-demo.mjs"],
		);
	}
} finally {
	rmSync(directory, { recursive: true, force: true });
}
