/**
 * Contatti sui servizi di terzi (WhatsApp, Instagram, Facebook, TikTok): stanno nel pacchetto
 * neutro perché le stesse regole servono al sito (zod) e allo Studio (validazione dei campi).
 */

export const SOCIAL_KINDS = ["instagram", "facebook", "tiktok"] as const;
export type SocialKind = (typeof SOCIAL_KINDS)[number];

/** Host ammessi per ogni servizio: un indirizzo di un altro sito non è un profilo social. */
const SOCIAL_HOSTS: Record<SocialKind, readonly string[]> = {
	instagram: ["instagram.com", "www.instagram.com"],
	facebook: ["facebook.com", "www.facebook.com", "m.facebook.com"],
	tiktok: ["tiktok.com", "www.tiktok.com"],
};

/** Vero se è un indirizzo https dell'host del servizio, senza nome utente o password nell'URL. */
export function isSocialUrl(kind: SocialKind, value: string): boolean {
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			url.username === "" &&
			url.password === "" &&
			SOCIAL_HOSTS[kind].includes(url.hostname.toLowerCase())
		);
	} catch {
		return false;
	}
}

/**
 * Le cifre di un numero WhatsApp in formato internazionale ("+39 333 123 4567" → "393331234567"),
 * oppure `undefined` se non lo è (serve il `+` e il prefisso del paese; da 8 a 15 cifre).
 */
export function whatsappDigits(value: string): string | undefined {
	const text = value.trim();
	if (!/^\+\d[\d\s().-]{6,18}$/.test(text)) return undefined;
	const digits = text.replace(/\D/g, "");
	return digits.length >= 8 && digits.length <= 15 ? digits : undefined;
}

/** Link `wa.me` del numero, oppure `undefined` se il numero non è valido. */
export function whatsappUrl(value: string): string | undefined {
	const digits = whatsappDigits(value);
	return digits ? `https://wa.me/${digits}` : undefined;
}
