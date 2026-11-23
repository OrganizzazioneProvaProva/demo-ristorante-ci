import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

type Inventory = Record<string, string>;

interface DocumentSnapshot {
	projectId: string;
	dataset: string;
	documents: Inventory;
}

export function collectDocumentRevisions(
	loaded: Record<string, unknown>,
): Inventory {
	const revisions = new Map<string, string>();
	for (const value of Object.values(loaded)) {
		const documents: unknown[] = Array.isArray(value) ? value : [value];
		for (const document of documents) {
			if (document === null) continue;
			if (
				typeof document !== "object" ||
				!("_id" in document) ||
				!("_rev" in document) ||
				typeof document._id !== "string" ||
				!document._id ||
				typeof document._rev !== "string" ||
				!document._rev
			) {
				throw new Error("Documento Sanity senza ID o revisione.");
			}
			const previous = revisions.get(document._id);
			if (previous !== undefined && previous !== document._rev) {
				throw new Error("Revisioni diverse per lo stesso documento Sanity.");
			}
			revisions.set(document._id, document._rev);
		}
	}
	return Object.fromEntries([...revisions].sort());
}

export function fingerprintDist(directory: string): Inventory {
	const root = resolve(directory);
	const files: Array<[string, string]> = [];
	for (const entry of readdirSync(root, {
		recursive: true,
		withFileTypes: true,
	})) {
		if (entry.isDirectory()) continue;
		if (!entry.isFile()) {
			throw new Error("Il dist contiene un elemento diverso da un file.");
		}
		const path = join(entry.parentPath, entry.name);
		const digest = createHash("sha256")
			.update(readFileSync(path))
			.digest("hex");
		files.push([relative(root, path), digest]);
	}
	if (!files.length) throw new Error("Il dist è vuoto.");
	return Object.fromEntries(files.sort());
}

export function buildEvidence(
	snapshot: DocumentSnapshot,
	dist: string,
	checkoutSha: string,
) {
	if (!/^[0-9a-f]{40}$/.test(checkoutSha)) {
		throw new Error("Serve lo SHA completo del checkout verificato.");
	}
	return {
		schemaVersion: 1,
		checkoutSha,
		projectId: snapshot.projectId,
		dataset: snapshot.dataset,
		documents: snapshot.documents,
		files: fingerprintDist(dist),
	};
}

if (import.meta.main) {
	const [snapshotPath, dist, checkoutSha, outputPath] = process.argv.slice(2);
	if (!snapshotPath || !dist || !checkoutSha || !outputPath) {
		throw new Error(
			"Servono snapshot, dist, SHA del checkout e file di uscita.",
		);
	}
	const snapshot = JSON.parse(
		readFileSync(snapshotPath, "utf8"),
	) as DocumentSnapshot;
	const evidence = buildEvidence(snapshot, dist, checkoutSha);
	writeFileSync(outputPath, `${JSON.stringify(evidence)}\n`, {
		flag: "wx",
		mode: 0o600,
	});
}
