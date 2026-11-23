import {
	type DefaultTreeAdapterTypes as Html,
	parse,
	defaultTreeAdapter as tree,
} from "parse5";

type Span = { startOffset: number; endOffset: number };

export function* htmlNodes(
	node: Html.Node,
	includeTemplates = true,
): Generator<Html.Node> {
	yield node;
	if ("childNodes" in node) {
		for (const child of node.childNodes)
			yield* htmlNodes(child, includeTemplates);
	}
	if (includeTemplates && "content" in node) yield* htmlNodes(node.content);
}

export function htmlAttr(node: Html.Element, name: string) {
	return node.attrs.find(
		(attribute) => attribute.name === name && !attribute.namespace,
	)?.value;
}

export function locateCsp(html: string, file: string) {
	const errors: Span[] = [];
	const document = parse(html, {
		sourceCodeLocationInfo: true,
		onParseError: (error) => errors.push(error),
	});
	const nodes = [...htmlNodes(document)];
	const elements = nodes.filter(tree.isElementNode);
	const metas = elements.filter((node) => node.tagName === "meta");
	const policies = metas.filter(
		(node) =>
			htmlAttr(node, "http-equiv")?.toLowerCase() === "content-security-policy",
	);
	const fail = (reason: string): never => {
		throw new Error(`${file}: ${reason}`);
	};
	if (policies.length !== 1)
		fail(policies.length ? "meta CSP duplicato" : "meta CSP mancante");
	const policy = policies[0];
	const head = policy.parentNode;
	const tag = policy.sourceCodeLocation?.startTag;
	const content = htmlAttr(policy, "content");
	if (!content?.trim()) return fail("meta CSP senza policy");
	if (
		!head ||
		!tree.isElementNode(head) ||
		head.tagName !== "head" ||
		!head.sourceCodeLocation?.startTag ||
		!tag
	) {
		return fail("meta CSP fuori dal head esplicito");
	}
	const charsets = metas.filter(
		(node) => htmlAttr(node, "charset") !== undefined,
	);
	const charset = charsets[0];
	const charsetTag = charset?.sourceCodeLocation?.startTag;
	if (
		charsets.length !== 1 ||
		charset.parentNode !== head ||
		!charsetTag ||
		charsetTag.endOffset > tag.startOffset
	) {
		return fail(
			"serve un unico meta charset iniziale nel head prima del meta CSP",
		);
	}
	if (
		errors.some(
			({ startOffset }) =>
				startOffset < charsetTag.endOffset ||
				(startOffset >= tag.startOffset && startOffset < tag.endOffset),
		)
	) {
		return fail("prefisso o meta CSP con sintassi HTML non verificabile");
	}
	const root = head.parentNode;
	const envelope = [
		...document.childNodes
			.filter(tree.isDocumentTypeNode)
			.map((node) => node.sourceCodeLocation),
		root && tree.isElementNode(root)
			? root.sourceCodeLocation?.startTag
			: undefined,
		head.sourceCodeLocation.startTag,
		charsetTag,
	];
	const comments = nodes.filter(tree.isCommentNode).flatMap((node) => {
		const loc = node.sourceCodeLocation;
		if (!loc) return [];
		const raw = html.slice(loc.startOffset, loc.endOffset);
		return raw.startsWith("<!--") && raw.endsWith("-->") ? [loc] : [];
	});
	const whitespace = /^[\t\n\f\r ]*$/;
	const safePrefix = (end: number) => {
		const spans = [...envelope, ...comments]
			.filter((span) => span != null)
			.filter((span) => span.endOffset <= end)
			.sort((left, right) => left.startOffset - right.startOffset);
		let cursor = 0;
		for (const span of spans) {
			if (
				span.startOffset < cursor ||
				!whitespace.test(html.slice(cursor, span.startOffset))
			)
				return false;
			cursor = span.endOffset;
		}
		return whitespace.test(html.slice(cursor, end));
	};
	if (!safePrefix(charsetTag.endOffset))
		fail("prefisso HTML prima del meta charset non verificabile");
	return {
		elements,
		policy: content,
		tag,
		charsetEnd: charsetTag.endOffset,
		early:
			safePrefix(tag.startOffset) &&
			!errors.some(({ startOffset }) => startOffset < tag.startOffset),
	};
}

export function moveCspAfterCharset(html: string, file: string): string {
	const { charsetEnd, tag } = locateCsp(html, file);
	return (
		html.slice(0, charsetEnd) +
		html.slice(tag.startOffset, tag.endOffset) +
		html.slice(charsetEnd, tag.startOffset) +
		html.slice(tag.endOffset)
	);
}
