import { companyEmailContact, parseCompanyEmails } from "./email.ts";
import type { SiteConfig } from "./site-config.ts";

const dnsName =
	/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const ipv4 = /^\d+(?:\.\d+){3}$/;
const reservedTld = /(?:^|\.)(?:example|test|invalid|localhost)$/;
const mailto = "mailto:";

/** Regole comuni a Studio e build; conserva l'URL originale per la pubblicazione. */
export function contentHttpsHostname(value: string): string | undefined {
	const authority = /^https:\/\/([^/?#]+)/i.exec(value)?.[1];
	if (!authority || authority.includes("@") || /[\s\p{Cc}\\]/u.test(value))
		return undefined;

	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return undefined;
	}
	const host = url.hostname.replace(/\.$/, "");
	if (!host || host === "localhost" || host.startsWith("[") || ipv4.test(host))
		return undefined;
	return host;
}

export function isAllowedHostName(value: string): boolean {
	return (
		value.length <= 253 &&
		dnsName.test(value) &&
		contentHttpsHostname(`https://${value}`) === value
	);
}

export type ContentLinkPolicy = Partial<Pick<SiteConfig, "kind" | "links">>;

/** Tipo di sito e lista host sono applicati alla build, anche se Studio è stato aggirato. */
export function requireContentHttpsLink(
	value: string,
	field: string,
	config: ContentLinkPolicy,
): void {
	const host = contentHttpsHostname(value);
	if (!host) throw new Error(`${field}: serve un indirizzo https valido.`);

	const allowed = config.links?.allowedHosts;
	if (
		allowed !== undefined &&
		!allowed.some((entry) => host === entry || host.endsWith(`.${entry}`))
	) {
		throw new Error(
			`${field}: host "${host}" fuori dalla lista links.allowedHosts [${allowed.join(", ")}]. La build si ferma.`,
		);
	}
	if (config.kind !== "demo" && reservedTld.test(host)) {
		throw new Error(
			`${field}: host riservato "${host}" ammesso solo nei demo. La build si ferma.`,
		);
	}
}

export function isPromotionLink(value: string): boolean {
	if (value.startsWith(mailto))
		return parseCompanyEmails(value.slice(mailto.length)) !== undefined;
	return (
		/^tel:\+?[0-9 ()-]+$/.test(value) ||
		contentHttpsHostname(value) !== undefined
	);
}

export function resolvePromotionLink(
	value: string,
	config: ContentLinkPolicy,
): string {
	if (value.startsWith(mailto)) {
		const contact = companyEmailContact(value.slice(mailto.length));
		if (!contact)
			throw new Error("promotion.link: destinatari mailto non validi.");
		return contact.href;
	}
	if (!value.startsWith("tel:"))
		requireContentHttpsLink(value, "promotion.link", config);
	return value;
}
