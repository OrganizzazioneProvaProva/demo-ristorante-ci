import { writeFileSync } from "node:fs";
import { loadSiteContent } from "@siti/data";
import { RISTORANTE_QUERIES } from "@siti/preset-ristorante/queries";
import { collectDocumentRevisions } from "../../build-evidence.ts";
import siteConfig from "../../site.config.ts";
import * as fixtures from "./fixtures.ts";

const evidencePath = process.env.SITI_BUILD_DOCUMENT_REVISIONS_PATH;

export const content = await loadSiteContent({
	env: process.env,
	site: siteConfig,
	extraQueries: RISTORANTE_QUERIES,
	fixtures: { ...fixtures, gallery: null },
	onLoaded: evidencePath
		? (loaded, settings) => {
				if (
					settings.source !== "sanity" ||
					!settings.projectId ||
					!settings.dataset
				) {
					throw new Error("L'inventario delle revisioni richiede dati Sanity.");
				}
				const snapshot = {
					projectId: settings.projectId,
					dataset: settings.dataset,
					documents: collectDocumentRevisions(loaded),
				};
				writeFileSync(evidencePath, JSON.stringify(snapshot), {
					flag: "wx",
					mode: 0o600,
				});
			}
		: undefined,
});
