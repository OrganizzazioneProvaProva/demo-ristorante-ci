/**
 * Query GROQ del core, una per documento dello Studio. Proiettano con `...` e dereferenziano
 * solo ciò che serve (le immagini e lo slug): i nomi dei campi non si ripetono qui, li fissano
 * lo Studio e gli schemi zod, e `schema-keys.test.ts` verifica che coincidano.
 *
 * I documenti singoli si prendono per `_id` (lo Studio li crea con id = tipo, vedi
 * `studio/core/src/structure.ts`). Le query girano con la prospettiva "published": le bozze non
 * arrivano mai al sito. Gli elenchi hanno un ordine fisso (`_createdAt`, poi `_id`): senza, Sanity
 * li restituisce in un ordine qualsiasi e promozioni e sitemap cambierebbero da una build all'altra.
 */

export interface ContentQuery {
	/** Testo GROQ. */
	groq: string;
	/** `single`: un documento o `null`; `list`: un elenco (anche vuoto). */
	kind: "single" | "list";
	/** Se vero, un documento assente non ferma la build (il risultato è `null`). */
	optional?: boolean;
}

/** Immagine del sito: i campi propri più l'asset con indirizzo e dimensioni. */
export const IMAGE_PROJECTION =
	'{..., asset->{url, "width": metadata.dimensions.width, "height": metadata.dimensions.height}}';

const singleton = (id: string, projection = "{...}"): string =>
	`*[_id == "${id}"][0]${projection}`;

export const CORE_QUERIES = {
	company: {
		groq: singleton("companyInfo", `{..., logo${IMAGE_PROJECTION}}`),
		kind: "single",
	},
	hours: { groq: singleton("openingHours"), kind: "single" },
	home: {
		groq: singleton("home", `{..., heroImage${IMAGE_PROJECTION}}`),
		kind: "single",
	},
	gallery: {
		groq: singleton("gallery", `{..., images[]${IMAGE_PROJECTION}}`),
		kind: "single",
		optional: true,
	},
	contacts: { groq: singleton("contacts"), kind: "single", optional: true },
	notices: {
		groq: '*[_type == "notice"] | order(_createdAt asc, _id asc){...}',
		kind: "list",
	},
	promotions: {
		groq: `*[_type == "promotion"] | order(_createdAt asc, _id asc){..., image${IMAGE_PROJECTION}}`,
		kind: "list",
	},
	faq: { groq: singleton("faq"), kind: "single", optional: true },
	testimonials: {
		groq: '*[_type == "testimonial"] | order(_createdAt asc, _id asc){...}',
		kind: "list",
	},
	pages: {
		groq: '*[_type == "page"] | order(_createdAt asc, _id asc){..., "slug": slug.current}',
		kind: "list",
	},
} as const satisfies Record<string, ContentQuery>;
