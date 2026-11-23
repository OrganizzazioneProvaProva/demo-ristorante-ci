import type { SiteConfigInput } from "@siti/config";

// Solo dati, nessun import a runtime: lo leggono sia il sito sia lo Studio di Sanity.
export default {
	slug: "demo-ristorante",
	// Sito dimostrativo: ammette dati e immagini segnaposto (solo con slug `prova` o `demo-*`).
	kind: "demo",
	indexing: "block",
	schemaVersion: 1,
	languages: ["it", "en"],
	// Prenotazioni: modulo di richiesta sul sito (02, moduli attivi). `none` le toglie tutte insieme.
	modules: { booking: "request" },
} satisfies SiteConfigInput;
