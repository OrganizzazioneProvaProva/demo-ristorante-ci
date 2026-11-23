import { isValidVatNumber, parseCompanyEmails } from "@siti/config";
import { z } from "zod";
import { rawImageSchema } from "./images.ts";

/** Tipi di soggetto (02, "Dati obbligatori del sito"): gli stessi valori dello Studio. */
export const LEGAL_TYPES = [
	"ditta-individuale",
	"societa-di-persone",
	"societa-di-capitali",
	"professionista",
] as const;

/**
 * Dati aziendali come arrivano da Sanity (documento `companyInfo`). La partita IVA e la sede
 * vanno in homepage e nel footer (02): senza, la build si ferma. REA e capitale sociale
 * sono obbligatori per le società di capitali (da validare con l'avvocato, 06).
 */
export const companyInfoSchema = z
	.object({
		name: z.string().trim().min(1),
		legalType: z.enum(LEGAL_TYPES),
		vatNumber: z
			.string()
			.refine(
				isValidVatNumber,
				"partita IVA non valida (11 cifre e cifra di controllo)",
			),
		address: z.object({
			street: z.string().trim().min(1),
			postalCode: z.string().regex(/^\d{5}$/, "il CAP ha 5 cifre"),
			city: z.string().trim().min(1),
			province: z
				.string()
				.regex(/^[A-Z]{2}$/, "sigla della provincia in maiuscolo"),
		}),
		phone: z.string().trim().min(1).nullish(),
		email: z
			.string()
			.refine(
				(value) => parseCompanyEmails(value) !== undefined,
				"servono da uno a tre indirizzi email distinti, separati da virgola",
			)
			.nullish(),
		reaNumber: z.string().trim().min(1).nullish(),
		shareCapital: z.string().trim().min(1).nullish(),
		/** Logo (JPEG, PNG, WebP, AVIF): grande nel piè di pagina; senza, compare il nome. */
		logo: rawImageSchema.nullish(),
	})
	.superRefine((company, ctx) => {
		if (company.legalType !== "societa-di-capitali") return;
		for (const field of ["reaNumber", "shareCapital"] as const) {
			if (!company[field]) {
				ctx.addIssue({
					code: "custom",
					path: [field],
					message: "obbligatorio per le società di capitali",
				});
			}
		}
	});

export type CompanyInfo = z.output<typeof companyInfoSchema>;
