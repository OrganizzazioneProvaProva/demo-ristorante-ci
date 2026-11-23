import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HOLIDAYS } from "@siti/config";
import {
	closurePeriodType,
	openingDayType,
	openingHoursType,
	WEEKDAYS,
} from "./opening-hours.ts";
import { pageType } from "./page.ts";
import { galleryType, promotionType } from "./sections.ts";

const bilingual = { languages: ["it", "en"], defaultLanguage: "it" } as const;

import { IMAGE_FORMATS, siteImageType } from "./site-image.ts";
import { CORE_SINGLETON_TYPES, singletonDocumentConfig } from "./structure.ts";

interface FieldLike {
	name: string;
	validation?: unknown;
	fields?: FieldLike[];
	options?: Record<string, unknown>;
	type?: { name: string } | string;
}
const fieldsOf = (type: unknown): FieldLike[] =>
	(type as { fields: FieldLike[] }).fields;
const field = (type: unknown, name: string): FieldLike => {
	const found = fieldsOf(type).find((f) => f.name === name);
	assert.ok(found, `campo "${name}" mancante`);
	return found;
};

/** Esegue la validazione registrando le chiamate a catena; restituisce le chiamate. */
function record(validation: unknown) {
	assert.equal(typeof validation, "function");
	const calls: Array<{ name: string; args: unknown[] }> = [];
	const rule: unknown = new Proxy(
		{},
		{
			get:
				(_t, name: string) =>
				(...args: unknown[]) => {
					calls.push({ name, args });
					return rule;
				},
		},
	);
	(validation as (rule: never) => unknown)(rule as never);
	return calls;
}

type Context = { parent?: Record<string, unknown> };
/** La funzione passata a `rule.custom(...)` di un campo, per provarla con valori veri. */
function customOf(
	target: FieldLike,
): (value: unknown, context: Context) => true | string {
	const call = record(target.validation).find((c) => c.name === "custom");
	assert.ok(call, `${target.name}: manca rule.custom`);
	return call.args[0] as (value: unknown, context: Context) => true | string;
}

describe("orari di apertura", () => {
	it("ha i sette giorni, dal lunedì alla domenica, tutti obbligatori", () => {
		const days = fieldsOf(openingHoursType).slice(0, 7);
		assert.deepEqual(
			days.map((d) => d.name),
			WEEKDAYS.map((d) => d.name),
		);
		for (const day of days) {
			assert.ok(
				record(day.validation).some((c) => c.name === "required"),
				`${day.name} deve essere obbligatorio`,
			);
		}
	});

	it("un giorno non chiuso richiede fasce valide e non sovrapposte", () => {
		const check = customOf(field(openingDayType, "intervals"));
		const open = { parent: { closed: false } };
		assert.equal(check([{ opens: "12:00", closes: "15:00" }], open), true);
		assert.equal(
			check(
				[
					{ opens: "12:00", closes: "15:00" },
					{ opens: "19:00", closes: "23:30" },
				],
				open,
			),
			true,
		);
		assert.match(String(check([], open)), /almeno una fascia/);
		assert.match(String(check(undefined, open)), /almeno una fascia/);
		assert.match(
			String(
				check(
					[
						{ opens: "12:00", closes: "15:00" },
						{ opens: "14:00", closes: "16:00" },
					],
					open,
				),
			),
			/sovrappongono/,
		);
	});

	it("un giorno chiuso non richiede fasce", () => {
		const check = customOf(field(openingDayType, "intervals"));
		assert.equal(check(undefined, { parent: { closed: true } }), true);
	});

	it("una chiusura straordinaria non può finire prima di iniziare", () => {
		const check = customOf(field(closurePeriodType, "to"));
		assert.equal(check("2026-08-20", { parent: { from: "2026-08-10" } }), true);
		assert.match(
			String(check("2026-08-01", { parent: { from: "2026-08-10" } })),
			/prima/,
		);
	});

	it("le festività chiuse sono una lista scelta dal titolare, facoltativa, con gli stessi id del core", () => {
		const f = field(openingHoursType, "closedHolidays");
		assert.equal(f.validation, undefined);
		const options = (f.options as { list: Array<{ value: string }> }).list;
		assert.deepEqual(
			options.map((o) => o.value),
			HOLIDAYS.map((h) => h.id),
		);
	});

	it("la festa del patrono deve essere una data esistente", () => {
		const patron = field(openingHoursType, "patronSaintDay");
		const check = customOf(field(patron, "day"));
		assert.equal(check(undefined, { parent: {} }), true);
		assert.equal(check(15, { parent: { day: 15, month: 8 } }), true);
		assert.match(
			String(check(31, { parent: { day: 31, month: 4 } })),
			/esistono/,
		);
		assert.match(
			String(check(undefined, { parent: { month: 8 } })),
			/esistono/,
		);
	});
});

describe("immagine", () => {
	it("accetta solo formati raster, mai SVG", () => {
		const accept = String(siteImageType.options?.accept);
		assert.deepEqual(accept.split(","), [...IMAGE_FORMATS]);
		assert.ok(!accept.includes("svg"));
	});

	it("il testo alternativo è un campo obbligatorio, nascosto per le immagini decorative", () => {
		const alt = field(siteImageType, "alt") as FieldLike & {
			hidden?: (ctx: { parent?: { decorative?: boolean } }) => boolean;
		};
		assert.deepEqual(
			record(alt.validation).map((c) => c.name),
			["required"],
		);
		assert.equal(alt.hidden?.({ parent: { decorative: true } }), true);
		assert.equal(alt.hidden?.({ parent: { decorative: false } }), false);
	});
});

describe("galleria, promozione, pagina", () => {
	it("la galleria ha da 1 a 30 immagini", () => {
		const calls = record(field(galleryType, "images").validation).map(
			(c) => c.name,
		);
		assert.deepEqual(calls, ["required", "min", "max"]);
	});

	it("la promozione scade dopo la data di inizio", () => {
		const check = customOf(field(promotionType(bilingual), "validTo"));
		assert.equal(
			check("2026-12-31", { parent: { validFrom: "2026-12-01" } }),
			true,
		);
		assert.match(
			String(check("2026-11-01", { parent: { validFrom: "2026-12-01" } })),
			/prima/,
		);
	});

	it("il link della promozione accetta solo https, mailto e tel", () => {
		const uri = record(field(promotionType(bilingual), "link").validation).find(
			(c) => c.name === "uri",
		);
		assert.ok(uri);
		assert.deepEqual((uri.args[0] as { scheme: string[] }).scheme, [
			"https",
			"mailto",
			"tel",
		]);
	});

	it("titolo e descrizione della pagina sono obbligatori", () => {
		for (const name of ["title", "description"]) {
			assert.ok(
				record(
					field(
						pageType({ languages: ["it", "en"], defaultLanguage: "it" }),
						name,
					).validation,
				).some((c) => c.name === "required"),
				`${name} deve essere obbligatorio`,
			);
		}
	});
});

describe("documenti singoli", () => {
	const config = singletonDocumentConfig(CORE_SINGLETON_TYPES);
	const actions = [
		{ action: "publish" },
		{ action: "delete" },
		{ action: "duplicate" },
		{ action: "unpublish" },
	];

	it("per i tipi singoli restano solo le azioni sicure", () => {
		const resolved = config.actions(
			actions as never,
			{
				schemaType: "openingHours",
			} as never,
		) as Array<{ action: string }>;
		assert.deepEqual(
			resolved.map((a) => a.action),
			["publish"],
		);
	});

	it("gli altri tipi mantengono tutte le azioni", () => {
		const resolved = config.actions(
			actions as never,
			{
				schemaType: "promotion",
			} as never,
		) as unknown[];
		assert.equal(resolved.length, 4);
	});

	it("i tipi singoli non compaiono in Nuovo documento", () => {
		const previous = [
			{ templateId: "openingHours" },
			{ templateId: "promotion" },
		];
		const resolved = config.newDocumentOptions(
			previous as never,
			{
				creationContext: { type: "global" },
			} as never,
		) as Array<{ templateId: string }>;
		assert.deepEqual(
			resolved.map((i) => i.templateId),
			["promotion"],
		);
	});
});
