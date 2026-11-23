import type { z } from "zod";

/**
 * Confronto tra le chiavi di uno schema zod e i campi di un tipo dello Studio di Sanity. I nomi
 * dei campi stanno in due posti (lo Studio che li scrive, zod che li legge): se divergono, un
 * campo dello Studio viene ignorato in silenzio o il sito si aspetta un campo che non esiste.
 * Qui si trovano le differenze, ricorsivamente nei tipi annidati. Sono ammesse solo le eccezioni
 * elencate, ciascuna con il motivo.
 */

/** Pezzo di un tipo compilato di Sanity che serve al confronto. */
export interface StudioType {
	name?: string;
	jsonType?: string;
	fields?: Array<{ name: string; type: StudioType }>;
	of?: StudioType[];
}

type ZodDef = {
	type?: string;
	shape?: Record<string, z.ZodType>;
	innerType?: z.ZodType;
	element?: z.ZodType;
};

const defOf = (schema: z.ZodType): ZodDef =>
	(schema as unknown as { _zod: { def: ZodDef } })._zod.def;

/** Toglie optional, nullable, default e simili: restituisce l'oggetto o l'elemento di un elenco. */
function unwrap(schema: z.ZodType): z.ZodType {
	let current = schema;
	for (let depth = 0; depth < 10; depth++) {
		const def = defOf(current);
		if (def.innerType) current = def.innerType;
		else if (def.type === "array" && def.element) current = def.element;
		else return current;
	}
	return current;
}

export function zodKeys(schema: z.ZodType): string[] | undefined {
	const def = defOf(unwrap(schema));
	return def.type === "object" && def.shape
		? Object.keys(def.shape)
		: undefined;
}

/** Il tipo vero: per un elenco, il tipo dei suoi elementi. */
function innerType(type: StudioType): StudioType | undefined {
	return type.jsonType === "array" ? type.of?.[0] : type;
}

function studioFields(type: StudioType) {
	return innerType(type)?.fields;
}

/** Campi di sistema di Sanity: non stanno nello schema dello Studio ma compaiono nei dati. */
const SYSTEM_KEYS = new Set(["_id", "_key", "_type"]);

export function diffKeys(options: {
	zod: z.ZodType;
	studio: StudioType;
	/** Nome da mostrare nei messaggi (per esempio `home`). */
	path: string;
	/** `tipo.campo` o `percorso.campo` → motivo dell'eccezione. */
	allow: Record<string, string>;
	/** Eccezioni usate: servono a vedere quelle ormai inutili. */
	used?: Set<string>;
}): string[] {
	const { zod, studio, path, allow, used } = options;
	const keys = zodKeys(zod);
	const fields = studioFields(studio);
	if (!keys) {
		throw new Error(
			`${path}: lo schema zod non è un oggetto (shape non raggiungibile)`,
		);
	}
	if (!fields) {
		throw new Error(`${path}: il tipo dello Studio non ha campi`);
	}
	const inner = innerType(studio);
	const owner = inner?.name && inner.name !== "object" ? inner.name : path;
	const problems: string[] = [];
	const allowed = (key: string): boolean => {
		const id = `${owner}.${key}`;
		if (id in allow) {
			used?.add(id);
			return true;
		}
		return false;
	};
	const shape = defOf(unwrap(zod)).shape as Record<string, z.ZodType>;
	const studioNames = fields.map((field) => field.name);
	for (const key of keys) {
		if (SYSTEM_KEYS.has(key) || studioNames.includes(key) || allowed(key))
			continue;
		problems.push(
			`${path}: zod legge "${key}" ma lo Studio non ha questo campo`,
		);
	}
	for (const field of fields) {
		if (keys.includes(field.name) || allowed(field.name)) continue;
		problems.push(`${path}: lo Studio ha "${field.name}" ma zod lo ignora`);
	}
	for (const field of fields) {
		const child = shape[field.name];
		// I riferimenti (`asset`) sono risolti dalla query: non si confrontano dentro.
		if (field.type.name === "reference") continue;
		if (!child || !zodKeys(child) || !studioFields(field.type)) continue;
		problems.push(
			...diffKeys({
				zod: child,
				studio: field.type,
				path: `${path}.${field.name}`,
				allow,
				used,
			}),
		);
	}
	return problems;
}
