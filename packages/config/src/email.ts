const localPart =
	/^[a-z0-9!$%&'*+/=_^{}|\x60~-]+(?:\.[a-z0-9!$%&'*+/=_^{}|\x60~-]+)*$/i;
const domainLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/** Fino a tre caselle semplici, mantenendo l'ordine deciso dall'attività. */
export function parseCompanyEmails(value: string): string[] | undefined {
	const addresses = value.split(/, ?/);
	if (addresses.length > 3 || /[\p{Cc}\u2028\u2029]/u.test(value))
		return undefined;

	const seen = new Set<string>();
	for (const address of addresses) {
		const [local, domain, extra] = address.split("@");
		if (
			!local ||
			!domain ||
			extra !== undefined ||
			address.length > 254 ||
			!localPart.test(local) ||
			!domain.includes(".") ||
			!domain.split(".").every((label) => domainLabel.test(label))
		)
			return undefined;

		const key = `${local}@${domain.toLowerCase()}`;
		if (seen.has(key)) return undefined;
		seen.add(key);
	}
	return addresses;
}

/** Recapito visibile, URI senza parametri e primo indirizzo per i campi scalari. */
export function companyEmailContact(value: string | null | undefined) {
	const addresses = value == null ? undefined : parseCompanyEmails(value);
	const first = addresses?.[0];
	if (!addresses || !first) return undefined;

	// RFC 6068: codifica i caratteri riservati nella casella, conservando @, + e le virgole fra caselle.
	const recipients = addresses.map((address) =>
		encodeURIComponent(address).replaceAll("%40", "@").replaceAll("%2B", "+"),
	);
	return {
		first,
		label: addresses.join(", "),
		href: `mailto:${recipients.join(",")}`,
	};
}
