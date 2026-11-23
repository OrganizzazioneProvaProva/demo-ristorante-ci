const IMAGE =
	'{..., asset->{url, "width": metadata.dimensions.width, "height": metadata.dimensions.height}}';

/** Si ignorano le foto disattivate o senza riferimento al file. */
const SECTIONS = `sections[]{..., items[]{..., "photo": select(coalesce(photoEnabled, true) && defined(photo.asset._ref) => photo${IMAGE})}}`;

/**
 * Query del menu (documento singolo `menu`): sezioni dirette e menu distinti (`groups`), con le
 * foto delle voci. I nomi dei campi li fissano lo Studio e `rawMenuSchema`. Stessa forma di
 * `ContentQuery` di `@siti/data` (il preset non dipende da quel pacchetto).
 */
export const RISTORANTE_QUERIES = {
	menu: {
		groq: `*[_id == "menu"][0]{..., ${SECTIONS}, groups[]{..., ${SECTIONS}}}`,
		kind: "single",
	},
} as const;
