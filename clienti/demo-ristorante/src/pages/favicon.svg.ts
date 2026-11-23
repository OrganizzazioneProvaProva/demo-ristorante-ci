import { monogramSvg } from "@siti/core/content/seo.ts";
import { company } from "../content/company.ts";
import { design } from "../design.ts";

/** Icona del sito: monogramma con l'iniziale dell'attività sui colori del tema (02, "Favicon"). */
export function GET() {
	const svg = monogramSvg({
		name: company.name,
		background: design.tokens.colors.accent,
		foreground: design.tokens.colors["accent-ink"],
	});
	return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
}
