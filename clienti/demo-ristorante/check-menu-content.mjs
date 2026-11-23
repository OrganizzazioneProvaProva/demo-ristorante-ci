import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseSiteConfig } from "@siti/config";
import { ASK_STAFF_NOTICE } from "@siti/preset-ristorante/allergens";
import { MENU_LABELS } from "@siti/preset-ristorante/labels";
import { formatPrice, resolveMenu } from "@siti/preset-ristorante/menu";
import siteConfig from "./site.config.ts";

// Reuse the parser already installed by the core for whole-site checks.
const requireCore = createRequire(
	new URL("../../core/package.json", import.meta.url),
);
const { parse } = requireCore("parse5");
const expectedMenuPath = process.argv[2];
assert(expectedMenuPath, "Pass the JSON snapshot used for this build");
const rawMenu = JSON.parse(readFileSync(expectedMenuPath, "utf8"));
const config = parseSiteConfig(siteConfig);
const dist = new URL("./dist/", import.meta.url);
const problems = [];

function elements(node, predicate) {
	return (node.childNodes ?? []).flatMap((child) => [
		...(child.tagName && predicate(child) ? [child] : []),
		...elements(child, predicate),
	]);
}

const attr = (node, name) =>
	node?.attrs?.find((value) => value.name === name)?.value;
const tagged = (tag) => (node) => node.tagName === tag;
const text = (node) =>
	node?.value ?? (node?.childNodes ?? []).map(text).join("");
const plain = (value) => value.trim().replace(/\s+/gu, " ");
const children = (node, predicate) =>
	(node?.childNodes ?? []).filter(predicate);

function want(condition, detail) {
	if (!condition) problems.push(detail);
}

function page(path, lang) {
	const tree = parse(readFileSync(new URL(path, dist), "utf8"));
	want(
		attr(elements(tree, tagged("html"))[0], "lang") === lang,
		path + ": incorrect HTML language",
	);
	return tree;
}

function checkHome(doc, prefix, cuisine) {
	const file = prefix + "index.html";
	const restaurant = elements(
		doc,
		(node) =>
			node.tagName === "script" && attr(node, "type") === "application/ld+json",
	)
		.map((node) => JSON.parse(text(node)))
		.filter((value) => value["@type"] === "Restaurant");
	want(
		restaurant.length === 1,
		file + ": expected a single Restaurant JSON-LD record",
	);
	if (restaurant.length !== 1) return;
	want(
		JSON.stringify(restaurant[0].servesCuisine ?? []) ===
			JSON.stringify(cuisine),
		file + ": servesCuisine differs from snapshot",
	);
	const canonical = attr(
		elements(
			doc,
			(node) => node.tagName === "link" && attr(node, "rel") === "canonical",
		)[0],
		"href",
	);
	want(
		canonical &&
			restaurant[0].menu === new URL("/" + prefix + "menu/", canonical).href,
		file + ": incorrect menu URL in JSON-LD",
	);
}

function checkAnchors(doc, catalog, path) {
	const counts = new Map();
	for (const node of elements(doc, (node) => Boolean(attr(node, "id")))) {
		const id = attr(node, "id");
		counts.set(id, (counts.get(id) ?? 0) + 1);
	}

	for (const node of elements(catalog, tagged("a"))) {
		const href = attr(node, "href");
		if (!href?.startsWith("#")) continue;
		let id;
		try {
			id = decodeURIComponent(href.slice(1));
		} catch {
			problems.push(path + ": invalid fragment " + href);
			continue;
		}
		want(
			counts.get(id) === 1,
			path + ": fragment " + href + " must have exactly one target in the page",
		);
	}
}

function sameLinks(nodes, ids, where) {
	const actual = nodes.map((node) => attr(node, "href"));
	want(
		JSON.stringify(actual) === JSON.stringify(ids.map((id) => "#" + id)),
		where + ": incorrect menu links",
	);
}

function compareGroup(node, group, where) {
	want(attr(node, "id") === group.id, where + ": incorrect group ID");
	want(
		plain(text(children(node, tagged("h2"))[0])) ===
			(group.title ? plain(group.title) : ""),
		where + ": incorrect group title",
	);
	if (group.description) {
		want(
			children(node, tagged("p")).some(
				(child) => plain(text(child)) === plain(group.description),
			),
			where + ": missing group description",
		);
	}
	const sections = children(node, tagged("section"));
	want(
		sections.length === group.sections.length,
		where + ": incorrect section count",
	);
	const links = children(node, tagged("nav")).flatMap((nav) =>
		elements(nav, tagged("a")),
	);
	sameLinks(
		links,
		group.sections.length > 1
			? group.sections.map((section) => section.id)
			: [],
		where,
	);
	return sections;
}

function compareSection(node, section, lang, where) {
	want(attr(node, "id") === section.id, where + ": incorrect section ID");
	want(
		plain(
			text(children(node, (child) => ["h2", "h3"].includes(child.tagName))[0]),
		) === plain(section.title),
		where + ": incorrect section title",
	);
	if (section.description) {
		want(
			children(node, tagged("p")).some(
				(child) => plain(text(child)) === plain(section.description),
			),
			where + ": missing section description",
		);
	}
	const rows = elements(
		node,
		(child) =>
			child.tagName === "li" && attr(child, "data-search") !== undefined,
	);
	want(rows.length === section.items.length, where + ": incorrect item count");
	section.items.forEach((item, index) => {
		const row = rows[index];
		if (!row) return;
		const line = children(row, tagged("div"))[0];
		const [name, price] = children(line, tagged("p"));
		const actualName = plain(
			(name?.childNodes ?? [])
				.filter((child) => child.nodeName === "#text")
				.map(text)
				.join(""),
		);
		want(
			actualName === plain(item.name),
			where + ": incorrect item name at position " + (index + 1),
		);
		want(
			plain(text(price)) === plain(formatPrice(item.price, lang)),
			where + ": incorrect price at position " + (index + 1),
		);
		const paragraphs = children(row, tagged("p")).map((child) =>
			plain(text(child)),
		);
		const labels = MENU_LABELS[lang];
		const metadata = paragraphs.at(-1);
		const location = where + " item " + (index + 1);
		want(
			paragraphs.length === (item.description ? 2 : 1),
			location + ": incorrect localized description count",
		);
		if (item.description)
			want(
				paragraphs[0] === plain(item.description),
				location + ": incorrect localized description",
			);
		if (item.components.length) {
			want(
				metadata?.includes(
					plain(labels.components + ": " + item.components.join(", ")),
				),
				location + ": incorrect localized components",
			);
		}
		const allergens = item.allergens;
		const allergenText =
			allergens.status === "ask-staff"
				? ASK_STAFF_NOTICE[lang]
				: labels.allergens +
					": " +
					(allergens.status === "none"
						? labels.noAllergens
						: allergens.allergens.map((entry) => entry.label).join(", "));
		want(
			metadata?.includes(allergenText),
			location + ": incorrect localized allergen notice",
		);
		const badge = children(name, tagged("span"))[0];
		want(
			item.featured ? plain(text(badge)) === labels.featured : !badge,
			location + ": incorrect featured badge",
		);
	});
}

for (const lang of config.languages) {
	const prefix = lang === config.defaultLanguage ? "" : lang + "/";
	const path = prefix + "menu/index.html";
	const { groups, cuisine, skipped } = resolveMenu(rawMenu, lang, config);
	if (skipped.length) {
		console.info(
			path + ": omitted untranslated entries " + JSON.stringify(skipped),
		);
	}
	checkHome(page(prefix + "index.html", lang), prefix, cuisine);

	const doc = page(path, lang);
	const catalogs = elements(doc, (node) => attr(node, "id") === "menu-catalog");
	want(catalogs.length === 1, path + ": expected a single menu catalog");
	if (catalogs.length !== 1) continue;
	const [catalog] = catalogs;
	const rendered = children(catalog, tagged("section"));
	want(rendered.length === groups.length, path + ": incorrect group count");
	checkAnchors(doc, catalog, path);
	sameLinks(
		elements(catalog, (node) => attr(node, "data-view-button") !== undefined),
		groups.length > 1 ? groups.map((group) => group.id) : [],
		path,
	);
	groups.forEach((group, groupIndex) => {
		const node = rendered[groupIndex];
		if (!node) return;
		const where = path + " group " + (groupIndex + 1);
		const sections = compareGroup(node, group, where);
		group.sections.forEach((section, index) => {
			if (sections[index])
				compareSection(
					sections[index],
					section,
					lang,
					where + " section " + (index + 1),
				);
		});
	});
	console.log(
		lang +
			": " +
			groups.length +
			" groups, " +
			groups.flatMap((group) => group.sections).length +
			" sections, cuisine " +
			JSON.stringify(cuisine),
	);
}

if (problems.length) {
	console.error(problems.join("\n"));
	process.exitCode = 1;
}
