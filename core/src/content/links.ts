import { contentHttpsHostname, isLocalSitePath } from "@siti/config";
import { z } from "zod";

/** Link editoriali https: la policy di ciascun sito si applica nei resolver. */
export const contentHttpsLinkSchema = z
	.string()
	.refine(
		(value) => contentHttpsHostname(value) !== undefined,
		"serve un indirizzo https valido senza credenziali, IP o localhost",
	);

export function isHttpsUrl(value: string): boolean {
	try {
		return new URL(value).protocol === "https:";
	} catch {
		return false;
	}
}

/** Percorso del sito (`/privacy/`) o indirizzo https: mai `//host` né altri schemi. */
export function isSiteLink(value: string): boolean {
	return isLocalSitePath(value) || isHttpsUrl(value);
}
