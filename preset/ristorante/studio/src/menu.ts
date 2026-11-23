import {
	type BooleanInputProps,
	defineField,
	defineType,
	useFormValue,
} from "sanity";
import { ALLERGENS } from "./allergens.ts";
import { CUISINES } from "./cuisines.ts";

export const DIETS = [
	{ title: "Nessuna indicazione", value: "none" },
	{ title: "Vegetariano", value: "vegetarian" },
	{ title: "Vegano", value: "vegan" },
] as const;

const euro = new Intl.NumberFormat("it-IT", {
	style: "currency",
	currency: "EUR",
});

export function formatPrice(price: unknown): string {
	return typeof price === "number" ? euro.format(price) : "prezzo mancante";
}

type MenuItemPhoto = { asset?: { _ref?: string } };
type MenuItemPhotoSettings = { photoEnabled?: boolean; photo?: MenuItemPhoto };

/** Le voci salvate prima del toggle mantengono le foto che hanno già caricato. */
function menuPhotoEnabled(item?: MenuItemPhotoSettings): boolean {
	return item?.photoEnabled ?? Boolean(item?.photo?.asset?._ref);
}

function MenuPhotoToggle(props: BooleanInputProps) {
	const photo = useFormValue([...props.path.slice(0, -1), "photo"]) as
		| MenuItemPhoto
		| undefined;
	return props.renderDefault({
		...props,
		value: menuPhotoEnabled({ photoEnabled: props.value, photo }),
	});
}

/**
 * Piatto. Il nome è uno solo (nome proprio, spesso uguale in inglese); la descrizione è
 * per lingua. Gli allergeni sono i 14 del Reg. UE 1169/2011: finché non si spunta
 * "verificati", il sito mostra l'invito a chiedere informazioni al personale, così un piatto
 * dove nessuno ha ancora compilato nulla non sembra "senza allergeni".
 */
export const itemType = defineType({
	name: "item",
	title: "Voce",
	type: "object",
	fields: [
		defineField({
			name: "name",
			title: "Nome",
			type: "string",
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: "description",
			title: "Descrizione",
			type: "localeText",
		}),
		defineField({
			name: "components",
			title: "Componenti (facoltativi)",
			type: "array",
			of: [{ type: "localeString" }],
			description:
				"Ciò di cui è fatta questa voce (per un piatto, gli ingredienti): uno per riga. Compaiono nella scheda e si possono cercare.",
			validation: (rule) => rule.max(30),
		}),
		defineField({
			name: "price",
			title: "Prezzo (€)",
			type: "number",
			validation: (rule) => rule.required().min(0).precision(2),
		}),
		defineField({
			name: "photoEnabled",
			title: "Mostra una foto",
			type: "boolean",
			description:
				"Attiva per caricare o mostrare una foto. Disattiva per nasconderla: la foto caricata resta salvata.",
			initialValue: false,
			components: { input: MenuPhotoToggle },
		}),
		defineField({
			name: "photo",
			title: "Foto (facoltativa)",
			type: "siteImage",
			hidden: ({ parent }) => !menuPhotoEnabled(parent),
		}),
		defineField({
			name: "allergens",
			title: "Allergeni presenti",
			type: "array",
			of: [{ type: "string" }],
			options: { list: [...ALLERGENS], layout: "grid" },
			validation: (rule) => rule.unique(),
		}),
		defineField({
			name: "allergensVerified",
			title: "Allergeni verificati",
			type: "boolean",
			description:
				"Spunta solo quando hai controllato la ricetta. Se non è spuntato, il sito invita a chiedere informazioni sugli allergeni al personale.",
			initialValue: false,
			validation: (rule) =>
				rule
					.custom((value, context) => {
						const allergens = (
							context.parent as { allergens?: unknown[] } | undefined
						)?.allergens;
						return !value && allergens && allergens.length > 0
							? "Hai indicato degli allergeni: spunta «verificati» quando sei sicuro che l'elenco sia completo."
							: true;
					})
					.warning(),
		}),
		defineField({
			name: "diet",
			title: "Dieta",
			type: "string",
			options: { list: [...DIETS], layout: "radio" },
			initialValue: "none",
		}),
		defineField({
			name: "featured",
			title: "Voce in evidenza",
			type: "boolean",
			description: "Compare nella sezione delle voci in evidenza della home.",
			initialValue: false,
		}),
	],
	preview: {
		select: {
			title: "name",
			price: "price",
			media: "photo",
			photoEnabled: "photoEnabled",
		},
		prepare: ({ title, price, media, photoEnabled }) => ({
			title,
			subtitle: formatPrice(price),
			media: menuPhotoEnabled({ photoEnabled, photo: media })
				? media
				: undefined,
		}),
	},
});

/** Sezione del menu (antipasti, pizze, dolci...) con i suoi piatti, nell'ordine di visualizzazione. */
export const menuSectionType = defineType({
	name: "menuSection",
	title: "Sezione del menu",
	type: "object",
	fields: [
		defineField({
			name: "title",
			title: "Nome della sezione",
			type: "localeString",
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: "description",
			title: "Descrizione (facoltativa)",
			type: "localeText",
		}),
		defineField({
			name: "items",
			title: "Voci",
			type: "array",
			of: [{ type: "item" }],
			validation: (rule) => rule.required().min(1),
		}),
	],
	preview: {
		select: { title: "title.it", items: "items" },
		prepare: ({ title, items }) => ({
			title,
			subtitle: `${Array.isArray(items) ? items.length : 0} voci`,
		}),
	},
});

/**
 * Un menu distinto del locale (per esempio «Pizzeria» e «Ristorante») con le sue sezioni.
 * Serve solo ai locali con più menu: nel sito diventa una sezione con il suo titolo, e si può
 * passare dall'una all'altra con i link in cima alla pagina.
 */
export const menuGroupType = defineType({
	name: "menuGroup",
	title: "Menu distinto",
	type: "object",
	fields: [
		defineField({
			name: "title",
			title: "Nome del menu",
			type: "localeString",
			validation: (rule) => rule.required(),
		}),
		defineField({
			name: "description",
			title: "Descrizione (facoltativa)",
			type: "localeText",
		}),
		defineField({
			name: "sections",
			title: "Sezioni",
			type: "array",
			of: [{ type: "menuSection" }],
			validation: (rule) => rule.required().min(1),
		}),
	],
	preview: {
		select: { title: "title.it", sections: "sections" },
		prepare: ({ title, sections }) => ({
			title,
			subtitle: `${Array.isArray(sections) ? sections.length : 0} sezioni`,
		}),
	},
});

type MenuDocument =
	| { sections?: unknown[]; mainTitle?: unknown; groups?: unknown[] }
	| undefined;
const hasItems = (value: unknown[] | undefined) =>
	Array.isArray(value) && value.length > 0;
const hasAnyText = (value: unknown) =>
	typeof value === "object" &&
	value !== null &&
	Object.values(value).some(
		(v) => typeof v === "string" && v.trim().length > 0,
	);

/**
 * Il menu del locale: un solo documento per sito. Un menu solo: basta compilare le sezioni.
 * Più menu (per esempio «Pizzeria» e «Ristorante»): le sezioni restano il PRIMO menu, gli si
 * dà un nome, e gli altri menu si aggiungono in «Altri menu». Non si sposta nessun piatto.
 */
export const menuType = defineType({
	name: "menu",
	title: "Menu",
	type: "document",
	fields: [
		defineField({
			name: "sections",
			title: "Sezioni (il menu principale)",
			type: "array",
			of: [{ type: "menuSection" }],
			validation: (rule) =>
				rule.custom((value, context) =>
					hasItems(value as unknown[] | undefined) ||
					hasItems((context.document as MenuDocument)?.groups)
						? true
						: "Aggiungi almeno una sezione (o un altro menu).",
				),
		}),
		defineField({
			name: "mainTitle",
			title: "Nome del menu principale (solo se hai più menu)",
			type: "localeString",
			description:
				"Se aggiungi altri menu qui sotto, dai un nome a questo (per esempio «Pizzeria»). Se hai un menu solo, lascia vuoto.",
		}),
		defineField({
			name: "cuisine",
			title: "Tipo di cucina (facoltativo)",
			type: "array",
			of: [{ type: "string" }],
			options: { list: [...CUISINES], layout: "grid" },
			description:
				"Fino a 5 tipi: li usa Google per capire che cucina fate. Se non ne scegli, non compare nulla.",
			validation: (rule) => rule.unique().max(5),
		}),
		defineField({
			name: "groups",
			title: "Altri menu (solo se servono)",
			type: "array",
			of: [{ type: "menuGroup" }],
			description:
				"Per i locali con più menu (per esempio «Ristorante» accanto a «Pizzeria»). Ogni menu ha il suo nome e le sue sezioni.",
			validation: (rule) =>
				rule.custom((value, context) => {
					const document = context.document as MenuDocument;
					return hasItems(value as unknown[] | undefined) &&
						hasItems(document?.sections) &&
						!hasAnyText(document?.mainTitle)
						? "Con più menu serve il nome anche del menu principale: compila «Nome del menu principale». Senza, la pubblicazione del sito si ferma."
						: true;
				}),
		}),
	],
	preview: { prepare: () => ({ title: "Menu" }) },
});
