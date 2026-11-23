import { loadSiteContent } from "@siti/data";
import { RISTORANTE_QUERIES } from "@siti/preset-ristorante/queries";
import siteConfig from "../../site.config.ts";
import * as fixtures from "./fixtures.ts";

export const content = await loadSiteContent({
	env: process.env,
	site: siteConfig,
	extraQueries: RISTORANTE_QUERIES,
	fixtures: { ...fixtures, gallery: null },
});
