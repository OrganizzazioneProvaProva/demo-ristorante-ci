import { join } from "node:path";
import { runE2e } from "./e2e.ts";

/** Dalla cartella del sito, dopo `astro build`: `node ../../core/src/checks/run-e2e.ts` */
const policyOnly = process.argv.includes("--policy-only");
const { failures, notes, pages } = await runE2e(
	join(process.cwd(), "dist"),
	policyOnly,
);
for (const note of [...new Set(notes)]) console.log(`INFO: ${note}`);
if (failures.length > 0) {
	console.error(`FAIL (${failures.length}):\n- ${failures.join("\n- ")}`);
	process.exit(1);
}
console.log(
	policyOnly
		? "OK: font e stili applicati, framing negato su loopback"
		: `OK: ${pages} pagine × 2 larghezze (390, 1440): axe, scorrimento, senza JavaScript, movimento ridotto, contrasto del pulsante`,
);
