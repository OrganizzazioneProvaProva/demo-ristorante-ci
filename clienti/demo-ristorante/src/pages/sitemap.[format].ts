import { sitemapEndpoint } from "@siti/core/content/sitemap.ts";
import { config, pages } from "../content/home.ts";

export const { GET, getStaticPaths } = sitemapEndpoint(pages, config);
