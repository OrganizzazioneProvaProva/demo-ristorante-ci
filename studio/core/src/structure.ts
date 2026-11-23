import type {
	DocumentActionsResolver,
	NewDocumentOptionsResolver,
} from "sanity";
import type { StructureBuilder } from "sanity/structure";

/** Documenti che esistono in una sola copia per sito (orari, galleria, dati aziendali...). */
export const CORE_SINGLETON_TYPES = [
	"companyInfo",
	"openingHours",
	"gallery",
	"contacts",
	"faq",
	"home",
] as const;

/** Voce del menu laterale che apre direttamente l'unico documento di quel tipo. */
export function singletonItem(
	S: StructureBuilder,
	type: string,
	title: string,
) {
	return S.listItem()
		.title(title)
		.id(type)
		.child(S.document().schemaType(type).documentId(type));
}

/**
 * Impostazioni di `document` per lo Studio: i tipi "singoli" non si possono creare di
 * nuovo dal menu "Nuovo documento" né cancellare, duplicare o ritirare dalla pubblicazione.
 */
export function singletonDocumentConfig(singletonTypes: readonly string[]) {
	const newDocumentOptions: NewDocumentOptionsResolver = (
		previous,
		{ creationContext },
	) =>
		creationContext.type === "global"
			? previous.filter((item) => !singletonTypes.includes(item.templateId))
			: previous;

	const actions: DocumentActionsResolver = (previous, { schemaType }) =>
		singletonTypes.includes(schemaType)
			? previous.filter(
					({ action }) =>
						action !== "delete" &&
						action !== "duplicate" &&
						action !== "unpublish",
				)
			: previous;

	return { newDocumentOptions, actions };
}
