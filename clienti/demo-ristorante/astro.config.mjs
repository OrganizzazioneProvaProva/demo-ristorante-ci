import { parseSiteConfig } from "@siti/config";
import { astroCsp } from "@siti/core/content/security.ts";
import { fontsConfig, writeThemeCss } from "@siti/design";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import siteConfig from "./site.config.ts";

const config = parseSiteConfig(siteConfig);
// Se il DESIGN.md non è valido o un contrasto non passa, la build si ferma qui. Scrive anche
// src/styles/theme.generated.css (non in git). Se cambi il DESIGN.md con `astro dev` acceso,
// riavvia il server: la configurazione si legge una volta sola.
const { tokens } = writeThemeCss(
	new URL("./DESIGN.md", import.meta.url),
	new URL("./src/styles/theme.generated.css", import.meta.url),
);

// https://astro.build/config
export default defineConfig({
	// URL pubblico del Custom Domain, usato da canonical e hreflang.
	site: "https://demo.edordopng.dev",
	i18n: {
		locales: config.languages,
		defaultLocale: config.defaultLanguage,
		// Italiano su /, le altre lingue su /<lingua>/. Nessun `fallback`: se una pagina
		// non esiste in una lingua, quella pagina non viene generata.
		routing: { prefixDefaultLocale: false },
	},
	// Font del DESIGN.md, scaricati in build e serviti dal sito (mai da server di terzi).
	// Le foto di Sanity si scaricano e si ottimizzano in build solo dai domini autorizzati (02).
	image: { domains: ["cdn.sanity.io"] },
	fonts: fontsConfig(tokens, fontProviders.fontsource()),
	// CSP nel <meta> con gli hash di Astro; le sorgenti esterne dipendono dai moduli attivi (04 §3).
	security: { csp: astroCsp(config) },
	vite: {
		plugins: [tailwindcss()],
		// Nessuno script inline nell'HTML (04: CSP con hash): i moduli restano file con `src`.
		build: { assetsInlineLimit: 0 },
	},
});
