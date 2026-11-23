import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type CompanyInfo, companyInfoSchema } from "./company.ts";
import {
	localBusinessJsonLd,
	openingHoursSpecification,
	parseCoordinates,
	serializeJsonLd,
} from "./json-ld.ts";
import { type OpeningHours, openingHoursSchema } from "./opening-hours.ts";

const company: CompanyInfo = companyInfoSchema.parse({
	name: "Ristorante X",
	legalType: "ditta-individuale",
	vatNumber: "01234567897",
	address: {
		street: "Via Esempio 12",
		postalCode: "94015",
		city: "Piazza Armerina",
		province: "EN",
	},
	phone: "+39 0935 000000",
	email: "info@ristorante-x.example",
});
const lunchDinner = {
	intervals: [
		{ opens: "12:00", closes: "15:00" },
		{ opens: "19:00", closes: "23:00" },
	],
};
const hours: OpeningHours = openingHoursSchema.parse({
	monday: { closed: true },
	tuesday: lunchDinner,
	wednesday: lunchDinner,
	thursday: lunchDinner,
	friday: lunchDinner,
	saturday: lunchDinner,
	sunday: { intervals: [{ opens: "12:00", closes: "15:00" }] },
	closures: [
		{ from: "2026-01-05", to: "2026-01-07" },
		{ from: "2027-08-16", to: "2027-08-31" },
	],
});

describe("serializeJsonLd", () => {
	const hostile = {
		name: "</script><script>alert(1)</script>",
		note: "Tom & Jerry > tutti",
		separators: `riga${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}fine`,
	};

	it("non lascia mai < > & né i separatori Unicode nel testo (non può chiudere il tag script)", () => {
		const text = serializeJsonLd(hostile);
		for (const forbidden of [
			"<",
			">",
			"&",
			String.fromCharCode(0x2028),
			String.fromCharCode(0x2029),
		]) {
			assert.ok(
				!text.includes(forbidden),
				`contiene ${JSON.stringify(forbidden)}`,
			);
		}
		assert.ok(!text.includes("</script"));
	});

	it("il risultato è JSON valido con gli stessi valori", () => {
		assert.deepEqual(JSON.parse(serializeJsonLd(hostile)), hostile);
	});
});

describe("openingHoursSpecification", () => {
	const specs = openingHoursSpecification(hours, "2026-11-19");

	it("raggruppa i giorni con la stessa fascia e non scrive i giorni di chiusura", () => {
		const lunch = specs.find(
			(s) => s.opens === "12:00" && s.closes === "15:00",
		);
		assert.ok(lunch);
		assert.equal(
			(lunch.dayOfWeek as string[]).length,
			6,
			"da martedì a domenica",
		);
		const dinner = specs.find((s) => s.opens === "19:00");
		assert.ok(dinner);
		assert.equal(
			(dinner.dayOfWeek as string[]).length,
			5,
			"da martedì a sabato",
		);
		const allDays = specs.flatMap((s) =>
			s.validFrom ? [] : (s.dayOfWeek as string[]),
		);
		assert.ok(!allDays.includes("https://schema.org/Monday"));
	});

	it("un orario oltre mezzanotte (venerdì 19:00-01:00) è UNA voce con closes 01:00", () => {
		const night = openingHoursSchema.parse({
			...hours,
			friday: { intervals: [{ opens: "19:00", closes: "01:00" }] },
			closures: [],
		});
		const friday = openingHoursSpecification(night, "2026-11-19").filter(
			(spec) =>
				(spec.dayOfWeek as string[]).includes("https://schema.org/Friday") &&
				spec.opens === "19:00",
		);
		assert.equal(friday.length, 1);
		assert.equal(friday[0]?.closes, "01:00");
	});

	it("una chiusura non ancora finita è una voce 00:00-00:00 con il periodo; una finita no", () => {
		const closures = specs.filter((s) => s.validFrom);
		assert.equal(closures.length, 1);
		assert.deepEqual(
			[
				closures[0]?.opens,
				closures[0]?.closes,
				closures[0]?.validFrom,
				closures[0]?.validThrough,
			],
			["00:00", "00:00", "2027-08-16", "2027-08-31"],
		);
		assert.ok(closures[0]);
		assert.equal((closures[0].dayOfWeek as string[]).length, 7);
	});

	it("una chiusura che finisce oggi è ancora valida (estremi compresi)", () => {
		assert.equal(
			openingHoursSpecification(hours, "2027-08-31").filter((s) => s.validFrom)
				.length,
			1,
		);
		assert.equal(
			openingHoursSpecification(hours, "2027-09-01").filter((s) => s.validFrom)
				.length,
			0,
		);
	});
});

describe("parseCoordinates", () => {
	it("legge lat,lng e rifiuta il resto", () => {
		assert.deepEqual(parseCoordinates("37.3856, 14.3708"), {
			latitude: 37.3856,
			longitude: 14.3708,
		});
		for (const bad of ["Piazza Armerina", "37.38", "91,10", "10,181", ""]) {
			assert.throws(() => parseCoordinates(bad), /Coordinate/, bad);
		}
	});
});

describe("localBusinessJsonLd", () => {
	const base = {
		type: "Restaurant",
		company,
		url: "https://demo.example/",
		today: "2026-11-19",
	};

	it("scrive i dati dell'attività: indirizzo, telefono senza 'tel:', partita IVA con IT, tipo", () => {
		const data = localBusinessJsonLd({ ...base, hours });
		assert.equal(data["@context"], "https://schema.org");
		assert.equal(data["@type"], "Restaurant");
		assert.equal(data["@id"], "https://demo.example/#business");
		assert.equal(data.telephone, "+390935000000");
		assert.equal(data.vatID, "IT01234567897");
		assert.deepEqual(data.address, {
			"@type": "PostalAddress",
			streetAddress: "Via Esempio 12",
			postalCode: "94015",
			addressLocality: "Piazza Armerina",
			addressRegion: "EN",
			addressCountry: "IT",
		});
	});

	it("l'@id viene dalla home nella lingua principale: IT ed EN descrivono la stessa entità, con url diversi", () => {
		const it = localBusinessJsonLd({
			...base,
			url: "https://demo.example/",
			idUrl: "https://demo.example/",
		});
		const en = localBusinessJsonLd({
			...base,
			url: "https://demo.example/en/",
			idUrl: "https://demo.example/",
		});
		assert.equal(it["@id"], en["@id"]);
		assert.notEqual(it.url, en.url);
		assert.equal(
			localBusinessJsonLd({ ...base, url: "https://demo.example/en/" })["@id"],
			"https://demo.example/en/#business",
		);
	});

	it("non scrive ciò che non c'è: senza telefono, email, orari e coordinate mancano le chiavi", () => {
		const bare = companyInfoSchema.parse({
			...company,
			phone: null,
			email: null,
		});
		const data = localBusinessJsonLd({ ...base, company: bare });
		for (const key of [
			"telephone",
			"email",
			"geo",
			"openingHoursSpecification",
			"image",
			"priceRange",
		]) {
			assert.ok(!(key in data), `non deve esserci ${key}`);
		}
	});

	it("un telefono non plausibile non diventa 'telephone'", () => {
		const odd = companyInfoSchema.parse({ ...company, phone: "chiama noi" });
		assert.ok(!("telephone" in localBusinessJsonLd({ ...base, company: odd })));
	});

	it("scrive il primo indirizzo aziendale nel campo scalare email", () => {
		const data = localBusinessJsonLd({
			...base,
			company: { ...company, email: "info@azienda.it, ordini@azienda.it" },
		});
		assert.equal(data.email, "info@azienda.it");
	});

	it("con le coordinate scrive geo; con coordinate non valide la build si ferma", () => {
		const data = localBusinessJsonLd({ ...base, geo: "37.3856,14.3708" });
		assert.deepEqual(data.geo, {
			"@type": "GeoCoordinates",
			latitude: 37.3856,
			longitude: 14.3708,
		});
		assert.throws(
			() => localBusinessJsonLd({ ...base, geo: "boh" }),
			/Coordinate/,
		);
	});

	it("non scrive mai aggregateRating (la valutazione di un sito terzo non è una recensione propria)", () => {
		assert.ok(!("aggregateRating" in localBusinessJsonLd({ ...base, hours })));
	});

	it("le proprietà del sottotipo arrivano da `extra`", () => {
		const data = localBusinessJsonLd({
			...base,
			extra: { servesCuisine: ["Pizza"] },
		});
		assert.deepEqual(data.servesCuisine, ["Pizza"]);
	});

	it("un nome ostile resta un valore: serializzato non chiude il tag script", () => {
		const evil = companyInfoSchema.parse({
			...company,
			name: "</script><script>alert(1)</script>",
		});
		const text = serializeJsonLd(
			localBusinessJsonLd({ ...base, company: evil }),
		);
		assert.ok(!text.includes("</script"));
		assert.equal(JSON.parse(text).name, "</script><script>alert(1)</script>");
	});
});
