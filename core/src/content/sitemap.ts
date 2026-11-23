import type { SiteConfig } from "@siti/config";
import { alternatesFor, type ResolvedPage } from "./pages.ts";
import { escapeXml } from "./xml.ts";

type SitemapPage = ResolvedPage & { noindex?: boolean };

/**
 * Sitemap XML (02, "SEO"): un indirizzo assoluto per ogni pagina risolta, con i link `hreflang`
 * alle altre lingue (gli stessi del `<head>`). Solo le pagine che esistono: quelle saltate per
 * mancanza di traduzione non compaiono. Per l'ordine fa fede l'elenco delle pagine.
 */
export function sitemapXml(
	pages: readonly SitemapPage[],
	config: Pick<SiteConfig, "languages" | "defaultLanguage">,
	site: string | URL,
): string {
	const absolute = (path: string) => new URL(path, site).href;
	const indexable = pages.filter(
		(page) =>
			!page.noindex &&
			page.slug !== "404" &&
			!/(?:^|\/)404(?:\.html)?\/?$/.test(page.path),
	);
	const urls = indexable.map((page) => {
		const links = alternatesFor(page, indexable, config)
			.map(
				(alt) =>
					`<xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${escapeXml(absolute(alt.path))}"/>`,
			)
			.join("");
		return `<url><loc>${escapeXml(absolute(page.path))}</loc>${links}</url>`;
	});
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>\n`;
}

export function sitemapEndpoint(
	pages: readonly SitemapPage[],
	config: Pick<SiteConfig, "indexing" | "languages" | "defaultLanguage">,
) {
	return {
		getStaticPaths: () =>
			config.indexing === "allow" ? [{ params: { format: "xml" } }] : [],
		GET({ site }: { site?: URL }) {
			if (!site)
				throw new Error(
					"Serve `site` in astro.config per la sitemap. La build si ferma.",
				);
			return new Response(sitemapXml(pages, config, site), {
				headers: { "Content-Type": "application/xml" },
			});
		},
	};
}
