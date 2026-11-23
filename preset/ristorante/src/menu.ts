import type { Language, SiteConfig } from "@siti/config";
import {
	type ResolvedImage,
	rawImageSchema,
	resolveImage,
} from "@siti/core/content/images.ts";
import { localizedTextSchema, textIn } from "@siti/core/content/localized.ts";
import { z } from "zod";
import {
	ALLERGEN_CODES,
	type AllergenCode,
	allergenLabel,
} from "./allergens.ts";
import { CUISINE_VALUES } from "./cuisines.ts";

export const DIETS = ["none", "vegetarian", "vegan"] as const;
export type Diet = (typeof DIETS)[number];

/** Il prezzo ha al massimo due decimali (come nello Studio). */
const priceSchema = z
	.number()
	.min(0)
	.refine(
		(p) => Math.abs(p * 100 - Math.round(p * 100)) < 1e-6,
		"al massimo due decimali",
	);

const rawItemSchema = z.object({
	name: z.string().trim().min(1),
	description: localizedTextSchema.nullish(),
	/** Ciò di cui è fatta la voce (per un piatto, gli ingredienti): uno per elemento, per lingua. */
	components: z.array(localizedTextSchema).nullish(),
	price: priceSchema,
	photoEnabled: z.boolean().nullish(),
	photo: rawImageSchema.nullish(),
	allergens: z.array(z.enum(ALLERGEN_CODES)).nullish(),
	allergensVerified: z.boolean().nullish(),
	diet: z.enum(DIETS).nullish(),
	featured: z.boolean().nullish(),
});

const rawSectionSchema = z.object({
	title: localizedTextSchema,
	description: localizedTextSchema.nullish(),
	items: z.array(rawItemSchema),
});

/** Un menu distinto (per esempio Pizzeria / Ristorante) con le sue sezioni. */
const rawGroupSchema = z.object({
	title: localizedTextSchema,
	description: localizedTextSchema.nullish(),
	sections: z.array(rawSectionSchema),
});

const hasText = (
	text: Record<string, string | null | undefined> | null | undefined,
) =>
	text
		? Object.values(text).some((v) => typeof v === "string" && v.trim())
		: false;

/**
 * Il menu come arriva da Sanity (documento `menu`).
 * - Un menu solo: basta `sections`.
 * - Più menu (Pizzeria / Ristorante): `sections` resta il PRIMO menu, con il nome in
 *   `mainTitle`, e gli altri stanno in `groups`. Per passare da uno a più menu non si sposta
 *   nessun piatto: si dà un nome al primo e si aggiungono gli altri.
 */
export const rawMenuSchema = z
	.object({
		sections: z.array(rawSectionSchema).nullish(),
		mainTitle: localizedTextSchema.nullish(),
		groups: z.array(rawGroupSchema).nullish(),
		/** Tipi di cucina dichiarati dal titolare (schema.org `servesCuisine`), da 0 a 5, senza doppioni. */
		cuisine: z.array(z.enum(CUISINE_VALUES)).max(5).nullish(),
	})
	.refine(
		(menu) => new Set(menu.cuisine ?? []).size === (menu.cuisine ?? []).length,
		"Tipi di cucina ripetuti",
	)
	.refine(
		(menu) => Boolean(menu.sections?.length || menu.groups?.length),
		"Il menu è vuoto: serve almeno una sezione (o un menu distinto con delle sezioni)",
	)
	.refine(
		(menu) =>
			!(
				menu.groups?.length &&
				menu.sections?.length &&
				!hasText(menu.mainTitle)
			),
		"Con più menu serve il nome anche del primo (mainTitle)",
	);

/**
 * Cosa mostrare sugli allergeni di un piatto. Solo se "verificati" l'elenco vale: un piatto
 * dove nessuno ha ancora compilato nulla non deve sembrare "senza allergeni".
 */
export type AllergenInfo =
	| {
			status: "listed";
			allergens: Array<{ code: AllergenCode; label: string }>;
	  }
	| { status: "none" }
	| { status: "ask-staff" };

export interface ResolvedItem {
	name: string;
	description?: string;
	/** Componenti nella lingua; quelli senza testo in questa lingua non compaiono (nessun ripiego). */
	components: string[];
	price: number;
	photo?: ResolvedImage;
	allergens: AllergenInfo;
	diet: Diet;
	featured: boolean;
}

export interface ResolvedSection {
	/** Ancora nella pagina: dal nome nella lingua principale, uguale in ogni lingua. */
	id: string;
	title: string;
	description?: string;
	items: ResolvedItem[];
}

export interface ResolvedGroup {
	/** Assente per il menu senza gruppi (un gruppo solo, senza titolo). */
	id?: string;
	title?: string;
	description?: string;
	sections: ResolvedSection[];
}

/** Una voce del menu che non compare in una lingua perché manca il nome in quella lingua. */
export interface SkippedSection {
	/** Posizione della sezione dentro il gruppo (o nel menu senza gruppi). */
	index?: number;
	/** Posizione del gruppo, se la voce sta in un gruppo o è il gruppo stesso. */
	groupIndex?: number;
	language: Language;
	missing: "title" | "groupTitle";
}

/** Ancora URL: minuscole, senza accenti, parole separate da trattini. */
export function slugify(text: string): string {
	return text
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function allergenInfo(
	allergens: readonly AllergenCode[],
	verified: boolean,
	language: Language,
): AllergenInfo {
	if (!verified) return { status: "ask-staff" };
	if (allergens.length === 0) return { status: "none" };
	return {
		status: "listed",
		allergens: allergens.map((code) => ({
			code,
			label: allergenLabel(code, language),
		})),
	};
}

/**
 * Il menu nella lingua richiesta. Il nome del piatto è uno solo; la descrizione è per lingua
 * e, se manca, non si mostra (nessun ripiego). Una sezione o un gruppo senza nome nella
 * lingua principale ferma la build; senza nome in un'altra lingua non compare in quella lingua
 * (con tutte le sue sezioni, se è un gruppo). Un gruppo che resta senza sezioni sparisce.
 * `sections` è l'elenco piatto di tutte le sezioni visibili, nell'ordine del menu.
 */
export function resolveMenu(
	rawMenu: unknown,
	language: Language,
	config: Pick<SiteConfig, "defaultLanguage">,
): {
	groups: ResolvedGroup[];
	sections: ResolvedSection[];
	skipped: SkippedSection[];
	/** Tipi di cucina dichiarati (valori inglesi di schema.org), nell'ordine scelto. */
	cuisine: string[];
} {
	const menu = rawMenuSchema.parse(rawMenu);
	const skipped: SkippedSection[] = [];
	const usedIds = new Set<string>();

	const idFor = (
		title: { [key: string]: string | null | undefined },
		fallback: string,
	) => {
		const base =
			slugify(textIn(title as never, config.defaultLanguage) ?? "") || fallback;
		let id = base;
		for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
		usedIds.add(id);
		return id;
	};

	const resolveItem = (item: z.infer<typeof rawItemSchema>): ResolvedItem => {
		const text = item.description
			? textIn(item.description, language)
			: undefined;
		const photo =
			item.photoEnabled !== false && item.photo
				? resolveImage(item.photo, language, config)
				: undefined;
		return {
			name: item.name,
			...(text ? { description: text } : {}),
			components: (item.components ?? [])
				.map((component) => textIn(component, language))
				.filter((component): component is string => Boolean(component)),
			price: item.price,
			...(photo ? { photo } : {}),
			allergens: allergenInfo(
				item.allergens ?? [],
				item.allergensVerified ?? false,
				language,
			),
			diet: item.diet ?? "none",
			featured: item.featured ?? false,
		};
	};

	const resolveSections = (
		rawSections: z.infer<typeof rawSectionSchema>[],
		groupIndex: number | undefined,
		where: string,
	): ResolvedSection[] => {
		const resolved: ResolvedSection[] = [];
		rawSections.forEach((raw, index) => {
			const title = textIn(raw.title, language);
			if (!title) {
				if (language === config.defaultLanguage) {
					throw new Error(
						`Sezione #${index + 1} ${where}: manca il nome in ${language} (lingua principale). La build si ferma.`,
					);
				}
				skipped.push({
					index,
					...(groupIndex !== undefined ? { groupIndex } : {}),
					language,
					missing: "title",
				});
				return;
			}
			const description = raw.description
				? textIn(raw.description, language)
				: undefined;
			resolved.push({
				id: idFor(raw.title, `sezione-${(groupIndex ?? 0) + 1}-${index + 1}`),
				title,
				...(description ? { description } : {}),
				items: raw.items.map(resolveItem),
			});
		});
		return resolved;
	};

	// Elenco dei menu: il primo (`sections` + `mainTitle`) e poi i gruppi.
	type Entry = {
		title: z.infer<typeof rawGroupSchema>["title"] | null | undefined;
		description?: z.infer<typeof rawGroupSchema>["description"];
		sections: z.infer<typeof rawSectionSchema>[];
	};
	const entries: Entry[] = [];
	if (menu.sections?.length) {
		entries.push({ title: menu.mainTitle, sections: menu.sections });
	}
	for (const group of menu.groups ?? []) entries.push(group);
	const titled = entries.length > 1 || hasText(entries[0]?.title);

	const groups: ResolvedGroup[] = [];
	entries.forEach((raw, groupIndex) => {
		let title: string | undefined;
		let id: string | undefined;
		if (titled) {
			title = raw.title ? textIn(raw.title, language) : undefined;
			if (!title) {
				if (language === config.defaultLanguage) {
					throw new Error(
						`Menu #${groupIndex + 1}: manca il nome in ${language} (lingua principale). La build si ferma.`,
					);
				}
				skipped.push({ groupIndex, language, missing: "groupTitle" });
				return;
			}
			id = idFor(raw.title as never, `menu-${groupIndex + 1}`);
		}
		const sections = resolveSections(
			raw.sections,
			titled ? groupIndex : undefined,
			titled ? `del menu #${groupIndex + 1}` : "del menu",
		);
		if (sections.length === 0) return;
		const description = raw.description
			? textIn(raw.description, language)
			: undefined;
		groups.push({
			...(id ? { id } : {}),
			...(title ? { title } : {}),
			...(description ? { description } : {}),
			sections,
		});
	});
	return {
		groups,
		sections: groups.flatMap((group) => group.sections),
		skipped,
		cuisine: [...(menu.cuisine ?? [])],
	};
}

/** I piatti segnati "in evidenza", nell'ordine del menu. */
export function featuredItems(
	sections: readonly ResolvedSection[],
): ResolvedItem[] {
	return sections.flatMap((section) =>
		section.items.filter((item) => item.featured),
	);
}

/** Prezzo in euro, nel formato della lingua: "8,50 €" in italiano, "€8.50" in inglese. */
export function formatPrice(price: number, language: Language): string {
	return new Intl.NumberFormat(language === "it" ? "it-IT" : "en-GB", {
		style: "currency",
		currency: "EUR",
	}).format(price);
}
