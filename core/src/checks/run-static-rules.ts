import { isAbsolute, join } from "node:path";
import { scanDirectory } from "./static-rules.ts";

/**
 * Applica le regole statiche alle cartelle indicate (relative alla cartella da cui si lancia):
 * `node ../../core/src/checks/run-static-rules.ts src`
 * Va chiamato nel `test` di ogni pacchetto che ha componenti o pagine (preset, siti).
 */
const targets = process.argv.slice(2);
if (targets.length === 0) {
	console.error("FAIL: indica almeno una cartella da controllare");
	process.exit(1);
}

const violations = targets.flatMap((target) => {
	const root = isAbsolute(target) ? target : join(process.cwd(), target);
	return scanDirectory(root).map((v) => ({ ...v, file: join(target, v.file) }));
});

if (violations.length > 0) {
	console.error(
		`FAIL (${violations.length}):\n${violations
			.map((v) => `- ${v.file}:${v.line} ${v.rule}: ${v.excerpt}`)
			.join("\n")}`,
	);
	process.exit(1);
}
console.log(`OK: regole statiche rispettate in ${targets.join(", ")}`);
