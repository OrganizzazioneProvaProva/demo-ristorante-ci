import { parseSiteConfig } from "@siti/config";
import { createSitePages } from "@siti/core/content/site-pages.ts";
import siteConfig from "../../site.config.ts";
import { content } from "./source.ts";

export const config = parseSiteConfig(siteConfig);
export const { pages, skipped, pageFor, homeFor } = createSitePages(
	content.home,
	content.pages,
	config,
);

export { pagePath } from "@siti/core/content/pages.ts";
