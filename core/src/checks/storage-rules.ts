/**
 * Cookie e memorizzazione nel browser (02, "Cookie"): il sito non ne usa e la pagina
 * "Informativa sui cookie" lo dichiara. Questo elenco è la dichiarazione: ciò che non è qui e
 * compare nel browser ferma la build (`checkStorage` in `e2e.ts`). Se un sito aggiunge uno
 * strumento (per esempio le statistiche), lo dichiara qui E nell'informativa.
 */
export interface StorageSnapshot {
	cookies: string[];
	localStorage: string[];
	sessionStorage: string[];
}

export const DECLARED_STORAGE: StorageSnapshot = {
	cookies: [],
	localStorage: [],
	sessionStorage: [],
};

/** Voci presenti nel browser che l'informativa non dichiara (vuoto = tutto in regola). */
export function undeclaredStorage(
	found: StorageSnapshot,
	declared: StorageSnapshot = DECLARED_STORAGE,
): string[] {
	const out: string[] = [];
	for (const kind of ["cookies", "localStorage", "sessionStorage"] as const) {
		for (const name of found[kind]) {
			if (!declared[kind].includes(name)) out.push(`${kind}: ${name}`);
		}
	}
	return out;
}
