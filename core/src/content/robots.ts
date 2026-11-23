import type { SiteConfig } from "@siti/config";

export function robotsResponse(
	config: Pick<SiteConfig, "indexing">,
	site?: URL,
): Response {
	if (!site) throw new Error("Serve `site` in astro.config per robots.txt.");
	const rules = "User-agent: *\nAllow: /\n";
	const sitemap =
		config.indexing === "allow"
			? `Sitemap: ${new URL("/sitemap.xml", site).href}\n`
			: "";
	return new Response(rules + sitemap, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}
