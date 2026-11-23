import { createClient } from "@sanity/client";
import { allowsPlaceholders, type SiteKind } from "@siti/config";
import { CORE_QUERIES, type ContentQuery } from "./queries.ts";

/** Versione dell'API di Sanity: fissa, così una query non cambia da sola nel tempo. */
export const SANITY_API_VERSION = "2026-11-01";

export type ContentSource = "fixtures" | "sanity";

export interface SourceSettings {
	source: ContentSource;
	projectId?: string;
	dataset?: string;
}

/**
 * Sceglie la sorgente dei contenuti dalle variabili d'ambiente. Predefinita: `fixtures` (dati
 * finti, nessuna rete). Con `SITI_CONTENT=sanity` servono `SANITY_PROJECT_ID` e `SANITY_DATASET`
 * esplicite: se mancano la build si ferma, mai un ripiego sui dati finti. I dati finti sono
 * ammessi solo nei siti dichiarati `kind: "demo"` con slug `prova` o `demo-*`
 * (stessa regola dei segnaposto, `allowsPlaceholders`).
 */
export function sourceSettings(
	env: Record<string, string | undefined>,
	site: { slug: string; kind?: SiteKind },
): SourceSettings {
	const requested = env.SITI_CONTENT?.trim() || "fixtures";
	if (requested === "fixtures") {
		if (!allowsPlaceholders(site)) {
			throw new Error(
				`Il sito "${site.slug}" usa i dati finti (SITI_CONTENT=fixtures): sono ammessi solo nei siti demo (kind "demo", slug prova o demo-*). Imposta SITI_CONTENT=sanity. La build si ferma.`,
			);
		}
		return { source: "fixtures" };
	}
	if (requested !== "sanity") {
		throw new Error(
			`SITI_CONTENT non valido: "${requested}" (valori ammessi: fixtures, sanity). La build si ferma.`,
		);
	}
	const projectId = env.SANITY_PROJECT_ID?.trim();
	const dataset = env.SANITY_DATASET?.trim();
	if (!projectId || !/^[a-z0-9]+$/.test(projectId)) {
		throw new Error(
			"Con SITI_CONTENT=sanity serve SANITY_PROJECT_ID (minuscole e cifre). La build si ferma.",
		);
	}
	if (!dataset || !/^[a-z0-9_-]+$/i.test(dataset)) {
		throw new Error(
			"Con SITI_CONTENT=sanity serve SANITY_DATASET (per esempio production). La build si ferma.",
		);
	}
	return { source: "sanity", projectId, dataset };
}

/** Ciò che serve del client Sanity: una query GROQ, un risultato. */
export interface QueryClient {
	fetch(query: string): Promise<unknown>;
}

export function createContentClient(settings: {
	projectId: string;
	dataset: string;
}): QueryClient {
	const client = createClient({
		projectId: settings.projectId,
		dataset: settings.dataset,
		apiVersion: SANITY_API_VERSION,
		// Alla build serve il dato appena pubblicato: la CDN può restituire una copia vecchia.
		useCdn: false,
		perspective: "published",
	});
	return { fetch: (query) => client.fetch(query) };
}

export type ContentResult = Record<string, unknown>;

/**
 * Legge tutti i contenuti. I risultati restano "grezzi": li convalidano e li risolvono gli
 * schemi zod del core e del preset, come per i dati finti. Un documento obbligatorio assente
 * (o un elenco che non è un elenco) ferma la build con il nome del documento.
 */
export async function loadContent(options: {
	settings: SourceSettings;
	queries: Record<string, ContentQuery>;
	fixtures: ContentResult;
	/** Solo per i test: sostituisce il client di rete. */
	client?: QueryClient;
}): Promise<ContentResult> {
	const { settings, queries, fixtures } = options;
	if (settings.source === "fixtures") return fixtures;
	if (!settings.projectId || !settings.dataset) {
		throw new Error("Impostazioni di Sanity incomplete. La build si ferma.");
	}
	const client =
		options.client ??
		createContentClient({
			projectId: settings.projectId,
			dataset: settings.dataset,
		});
	const entries = await Promise.all(
		Object.entries(queries).map(async ([name, query]) => {
			const result = await client.fetch(query.groq);
			if (query.kind === "list") {
				if (!Array.isArray(result)) {
					throw new Error(
						`Sanity: la query "${name}" doveva restituire un elenco. La build si ferma.`,
					);
				}
				return [name, result] as const;
			}
			if (result === null || result === undefined) {
				if (query.optional) return [name, null] as const;
				throw new Error(
					`Sanity: il documento "${name}" non esiste (o non è pubblicato). Crealo e pubblicalo nello Studio. La build si ferma.`,
				);
			}
			return [name, result] as const;
		}),
	);
	return Object.fromEntries(entries);
}

export async function loadSiteContent(options: {
	env: Parameters<typeof sourceSettings>[0];
	site: Parameters<typeof sourceSettings>[1];
	fixtures: ContentResult;
	extraQueries?: Record<string, ContentQuery>;
	client?: QueryClient;
	onLoaded?: (content: ContentResult, settings: SourceSettings) => void;
}): Promise<ContentResult> {
	const settings = sourceSettings(options.env, options.site);
	const loaded = await loadContent({
		settings,
		queries: { ...CORE_QUERIES, ...options.extraQueries },
		fixtures: options.fixtures,
		client: options.client,
	});
	options.onLoaded?.(loaded, settings);
	return {
		...loaded,
		contacts: loaded.contacts ?? {},
	};
}
