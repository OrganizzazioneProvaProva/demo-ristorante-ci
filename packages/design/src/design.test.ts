import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	contrastRatio,
	fontsConfig,
	fontVariables,
	MOTION_LEVELS,
	parseDesignMd,
	themeCss,
} from "./index.ts";

const COLORS = {
	bg: "#F4F7F5",
	surface: "#FFFFFF",
	ink: "#0E2A47",
	muted: "#4B6076",
	line: "#C5D0DA",
	accent: "#1D5FBF",
	"accent-ink": "#FFFFFF",
	pop: "#F2C230",
	"pop-ink": "#0E2A47",
};

interface Options {
	colors?: Record<string, string | undefined>;
	extraFrontMatter?: string;
	body?: string;
	components?: string;
	omitFrontMatter?: boolean;
}

function design(options: Options = {}): string {
	const colors = { ...COLORS, ...options.colors };
	const colorLines = Object.entries(colors)
		.filter(([, value]) => value !== undefined)
		.map(([role, value]) => `  ${role}: "${value}"`)
		.join("\n");
	const body =
		options.body ??
		"\n## Overview\n\nTesto.\n\n## Colors\n\nTesto.\n\n## Typography\n\nTesto.\n";
	if (options.omitFrontMatter) return body;
	return `---
name: Prova
colors:
${colorLines}
typography:
  display:
    fontFamily: Familjen Grotesk
    fontWeight: 700
  body:
    fontFamily: Source Sans 3
    fontWeight: 400
  label:
    fontFamily: Source Sans 3
    fontWeight: 600
rounded:
  ui: 2px
${options.components ?? ""}${options.extraFrontMatter ?? ""}---
${body}`;
}

describe("contrasto", () => {
	it("nero su bianco è 21:1 e un colore su se stesso è 1:1", () => {
		assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
		assert.equal(contrastRatio("#1D5FBF", "#1D5FBF"), 1);
	});

	it("rifiuta colori che non sono #rrggbb", () => {
		assert.throws(() => contrastRatio("blue", "#ffffff"), /#rrggbb/);
	});
});

describe("parseDesignMd", () => {
	it("accetta un DESIGN.md valido e controlla il contrasto", () => {
		const { tokens, findings, sections } = parseDesignMd(design());
		assert.equal(tokens.name, "Prova");
		assert.ok(findings.length >= 8);
		assert.ok(findings.every((f) => f.passes));
		assert.deepEqual(sections, ["Overview", "Colors", "Typography"]);
	});

	it("rifiuta un colore che non è #rrggbb", () => {
		assert.throws(
			() => parseDesignMd(design({ colors: { bg: "white" } })),
			/colors\.bg/,
		);
	});

	it("rifiuta un ruolo mancante e un ruolo in più", () => {
		assert.throws(
			() => parseDesignMd(design({ colors: { accent: undefined } })),
			/colors\.accent/,
		);
		assert.throws(
			() => parseDesignMd(design({ colors: { brand: "#123456" } })),
			/colors/,
		);
	});

	it("blocca un contrasto insufficiente e dice quale coppia", () => {
		assert.throws(
			() => parseDesignMd(design({ colors: { ink: "#CCCCCC" } })),
			/contrasto insufficiente — Testo su sfondo/,
		);
	});

	it("elenca tutti i contrasti che non passano, non solo il primo", () => {
		try {
			parseDesignMd(design({ colors: { ink: "#CCCCCC", muted: "#DDDDDD" } }));
			assert.fail("doveva lanciare un errore");
		} catch (error) {
			const message = String((error as Error).message);
			assert.match(message, /Testo su sfondo/);
			assert.match(message, /Testo secondario su sfondo/);
		}
	});

	it("controlla anche le coppie dei componenti", () => {
		const components = `components:
  button-bad:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.pop}"
`;
		assert.throws(
			() => parseDesignMd(design({ components })),
			/Componente button-bad/,
		);
	});

	it("rifiuta un riferimento a un colore che non esiste", () => {
		const components = `components:
  button-x:
    backgroundColor: "{colors.nope}"
    textColor: "{colors.ink}"
`;
		assert.throws(
			() => parseDesignMd(design({ components })),
			/Riferimento sconosciuto/,
		);
	});

	it("rifiuta un file senza front matter", () => {
		assert.throws(
			() => parseDesignMd(design({ omitFrontMatter: true })),
			/front matter/,
		);
	});

	it("rifiuta sezioni duplicate o fuori ordine, e ignora quelle sconosciute", () => {
		assert.throws(
			() =>
				parseDesignMd(design({ body: "\n## Colors\n\nx\n\n## Colors\n\ny\n" })),
			/duplicata/,
		);
		assert.throws(
			() =>
				parseDesignMd(
					design({ body: "\n## Typography\n\nx\n\n## Colors\n\ny\n" }),
				),
			/fuori ordine/,
		);
		const parsed = parseDesignMd(
			design({ body: "\n## Overview\n\nx\n\n## Note interne\n\ny\n" }),
		);
		assert.deepEqual(parsed.sections, ["Overview", "Note interne"]);
	});
});

describe("livello di movimento", () => {
	const motionOf = (level?: string) =>
		parseDesignMd(
			design({ extraFrontMatter: level ? `motion: ${level}\n` : "" }),
		).tokens.motion;

	it("senza la chiave vale light-animation; i tre livelli sono accettati", () => {
		assert.equal(motionOf(), "light-animation");
		for (const level of MOTION_LEVELS) assert.equal(motionOf(level), level);
		assert.deepEqual(
			[...MOTION_LEVELS],
			["no-animation", "light-animation", "expressive-animation"],
		);
	});

	it("rifiuta un livello sconosciuto o scritto con il trattino basso", () => {
		assert.throws(() => motionOf("no_animation"), /motion/);
		assert.throws(() => motionOf("wild"), /motion/);
	});

	it("il cambio di pagina nativo sta nel CSS generato, tranne con no-animation", () => {
		const css = (level: string) =>
			themeCss(
				parseDesignMd(design({ extraFrontMatter: `motion: ${level}\n` }))
					.tokens,
			);
		for (const level of ["light-animation", "expressive-animation"]) {
			assert.match(
				css(level),
				/@media \(prefers-reduced-motion: no-preference\) \{\s*@view-transition \{\s*navigation: auto;/,
			);
		}
		assert.doesNotMatch(css("no-animation"), /@view-transition/);
	});
});

describe("CSS e font generati", () => {
	const { tokens } = parseDesignMd(design());

	it("scrive tutti i ruoli come variabili --t-* e lo stack dei font", () => {
		const css = themeCss(tokens);
		for (const role of Object.keys(COLORS)) {
			assert.ok(css.includes(`--t-${role}:`), `manca --t-${role}`);
		}
		assert.ok(css.includes("--t-font-display: var(--font-familjen-grotesk)"));
		assert.ok(css.includes("--t-font-body: var(--font-source-sans-3)"));
		assert.ok(css.includes("--t-radius: 2px;"));
		assert.ok(css.includes("Generato da DESIGN.md"));
	});

	it("deriva famiglie e pesi per la Fonts API di Astro", () => {
		const fonts = fontsConfig(tokens, "fontsource");
		assert.deepEqual(
			fonts.map((f) => [f.name, f.cssVariable, f.weights]),
			[
				["Familjen Grotesk", "--font-familjen-grotesk", [700]],
				["Source Sans 3", "--font-source-sans-3", [400, 600]],
			],
		);
		assert.deepEqual(fontVariables(tokens), [
			"--font-familjen-grotesk",
			"--font-source-sans-3",
		]);
	});
});
