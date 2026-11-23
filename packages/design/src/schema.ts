import { z } from "zod";

/** Solo `#rrggbb` (04 §3: i colori dei clienti sono validati, mai valori CSS liberi). */
export const hexColorSchema = z
	.string()
	.regex(/^#[0-9a-fA-F]{6}$/, "serve un colore #rrggbb");

/**
 * I ruoli dei colori sono fissi e li definisce il core: il cliente cambia solo i valori,
 * mai la struttura (02, "Design system"). I componenti usano solo questi nomi.
 */
export const COLOR_ROLES = [
	"bg",
	"surface",
	"ink",
	"muted",
	"line",
	"accent",
	"accent-ink",
	"pop",
	"pop-ink",
] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

const colorsSchema = z.strictObject(
	Object.fromEntries(
		COLOR_ROLES.map((role) => [role, hexColorSchema]),
	) as Record<ColorRole, typeof hexColorSchema>,
);

/** Una famiglia di font: solo nomi semplici, che il provider Fontsource conosce. */
const fontFamilySchema = z
	.string()
	.regex(/^[A-Za-z0-9][A-Za-z0-9 ]{1,40}$/, "nome di famiglia non valido");

const typographyTokenSchema = z.strictObject({
	fontFamily: fontFamilySchema,
	fontWeight: z.number().int().min(100).max(900),
	/** Famiglia di ripiego mentre il font si carica (e se non si carica). */
	fontFallback: z.enum(["sans", "serif"]).default("sans"),
});
export type TypographyToken = z.infer<typeof typographyTokenSchema>;

const dimensionSchema = z
	.string()
	.regex(/^\d+(\.\d+)?(px|rem)$/, "serve una misura in px o rem");

/** Riferimento a un colore (`{colors.accent}`) oppure un colore diretto. */
const colorOrReferenceSchema = z.union([
	hexColorSchema,
	z
		.string()
		.regex(/^\{colors\.[a-z-]+\}$/, "riferimento del tipo {colors.accent}"),
]);

const componentSchema = z.strictObject({
	backgroundColor: colorOrReferenceSchema.optional(),
	textColor: colorOrReferenceSchema.optional(),
});

/**
 * Livello di movimento del sito (`core/DESIGN.md`, Motion): lo sceglie il `DESIGN.md` del cliente,
 * i componenti non cambiano. Il movimento ridotto del sistema vince sempre.
 * - `no-animation`: nessuna animazione né transizione di pagina.
 * - `light-animation`: il livello della Base (predefinito).
 * - `expressive-animation`: più ampio (durate più lunghe, spostamenti maggiori, zoom delle immagini).
 */
export const MOTION_LEVELS = [
	"no-animation",
	"light-animation",
	"expressive-animation",
] as const;
export type MotionLevel = (typeof MOTION_LEVELS)[number];
export const DEFAULT_MOTION_LEVEL: MotionLevel = "light-animation";

export const designTokensSchema = z.strictObject({
	motion: z.enum(MOTION_LEVELS).default(DEFAULT_MOTION_LEVEL),
	version: z.string().optional(),
	name: z.string().min(1),
	description: z.string().optional(),
	colors: colorsSchema,
	typography: z.strictObject({
		display: typographyTokenSchema,
		body: typographyTokenSchema,
		label: typographyTokenSchema.optional(),
	}),
	rounded: z.strictObject({ ui: dimensionSchema }),
	components: z.record(z.string(), componentSchema).default({}),
});

export type DesignTokens = z.output<typeof designTokensSchema>;
