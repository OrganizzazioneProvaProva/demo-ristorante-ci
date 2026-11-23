import {
	isSocialUrl,
	type Language,
	SOCIAL_KINDS,
	type SocialKind,
	whatsappUrl,
} from "@siti/config";
import type { RawContacts } from "./contacts.ts";

/** Contatti sui servizi di terzi, per il piè di pagina: WhatsApp e i profili social presenti. */
export type ContactKind = "whatsapp" | SocialKind;

export interface ContactLink {
	kind: ContactKind;
	label: string;
	href: string;
}

/** Nomi dei servizi: sono marchi, uguali in ogni lingua. */
const LABELS: Record<ContactKind, string> = {
	whatsapp: "WhatsApp",
	instagram: "Instagram",
	facebook: "Facebook",
	tiktok: "TikTok",
};

/**
 * I link ai contatti presenti, nell'ordine: WhatsApp, Instagram, Facebook, TikTok. Quelli assenti
 * non compaiono. Un valore non valido ferma la build (lo Studio lo segnala, ma lì è solo un avviso).
 */
export function contactLinks(
	contacts: RawContacts | null | undefined,
	_language: Language,
): ContactLink[] {
	const links: ContactLink[] = [];
	if (contacts?.whatsapp) {
		const href = whatsappUrl(contacts.whatsapp);
		if (!href) {
			throw new Error(
				`Numero WhatsApp non valido: "${contacts.whatsapp}" (serve il formato internazionale, per esempio +39 333 1234567). La build si ferma.`,
			);
		}
		links.push({ kind: "whatsapp", label: LABELS.whatsapp, href });
	}
	const urls: Record<SocialKind, string | null | undefined> = {
		instagram: contacts?.instagramUrl,
		facebook: contacts?.facebookUrl,
		tiktok: contacts?.tiktokUrl,
	};
	for (const kind of SOCIAL_KINDS) {
		const url = urls[kind];
		if (!url) continue;
		if (!isSocialUrl(kind, url)) {
			throw new Error(
				`Indirizzo ${LABELS[kind]} non valido: "${url}" (serve un indirizzo https di ${LABELS[kind]}). La build si ferma.`,
			);
		}
		links.push({ kind, label: LABELS[kind], href: url });
	}
	return links;
}
