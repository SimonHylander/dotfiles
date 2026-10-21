/**
 * Lists, tallies, and deletes tests by title path with the TypeScript compiler API.
 * Run it from the target repo root with Node 23.6 or later. It loads the `typescript`
 * package at `PRUNE_TS`, else the one in the repo's node_modules. TypeScript 7 has no JS
 * compiler API, so a repo on 7 needs `PRUNE_TS` pointing at a 5.x or 6.x install.
 *
 *   node prune.ts list <file...>          print every test's title path as JSON
 *   node prune.ts tally <state-dir>       merge reviewer votes and print the next phase
 *   node prune.ts apply <deletions.json>  delete tests, then the imports and helpers they leave unused
 */
import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type * as TS from "typescript";

const ts: typeof TS = createRequire(join(process.cwd(), "package.json"))(process.env.PRUNE_TS ?? "typescript");
if (typeof ts.createSourceFile !== "function") {
	console.error("The loaded typescript package has no JS compiler API. Set PRUNE_TS to a typescript 5.x or 6.x directory.");
	process.exit(2);
}

type TestRef = { file: string; title: string[]; row?: number };
type Vote = TestRef & { category: string; reason: string };
type VoteFile = { files: string[]; votes: Vote[] };
type Ruling = TestRef & { verdict: "delete" | "keep"; reason: string };
type Edit = { start: number; end: number };

type TestNode = {
	kind: "suite" | "test";
	title: string[];
	statement: TS.ExpressionStatement;
	table?: TS.ArrayLiteralExpression;
	body?: TS.Block;
	children: TestNode[];
};

const ROOTS = new Set(["describe", "suite", "context", "it", "test", "specify"]);
const SUITES = new Set(["describe", "suite", "context"]);
const MODIFIERS = new Set([
	"only", "skip", "todo", "concurrent", "sequential", "shuffle", "fails", "failing",
	"each", "for", "skipIf", "runIf", "describe", "serial", "parallel", "fixme", "slow",
]);
const TABLES = new Set(["each", "for"]);

// Reviewers may write absolute or symlinked paths. Every path is compared repo-relative.
const repoPath = (file: string) => relative(realpathSync(process.cwd()), existsSync(file) ? realpathSync(file) : resolve(file));
const parse = (file: string, text: string) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
const sameTitle = (a: string[], b: string[]) => a.length === b.length && a.every((part, i) => part === b[i]);
const key = (ref: TestRef) => JSON.stringify([repoPath(ref.file), ref.title, ref.row ?? null]);
const isFunction = (node: TS.Node) => ts.isArrowFunction(node) || ts.isFunctionExpression(node);

// Recognises `it(...)`, `test.skip(...)`, `it.each([...])(...)`, `test.describe(...)` and similar.
// A title that is not a string literal is matched by its source text, e.g. `Foo.name`.
function classify(statement: TS.ExpressionStatement, sf: TS.SourceFile) {
	const call = statement.expression;
	if (!ts.isCallExpression(call)) return;
	const [titleArg, ...rest] = call.arguments;
	const fn = rest.find(isFunction);
	if (!titleArg || !fn) return;

	let callee: TS.Expression = call.expression;
	const chain: string[] = [];
	let table: TS.ArrayLiteralExpression | undefined;
	for (;;) {
		if (ts.isPropertyAccessExpression(callee)) {
			chain.push(callee.name.text);
			callee = callee.expression;
		} else if (ts.isCallExpression(callee)) {
			const [arg] = callee.arguments;
			const factory = callee.expression;
			if (ts.isPropertyAccessExpression(factory) && TABLES.has(factory.name.text) && arg && ts.isArrayLiteralExpression(arg)) table = arg;
			callee = factory;
		} else if (ts.isTaggedTemplateExpression(callee)) {
			callee = callee.tag;
		} else break;
	}
	if (!ts.isIdentifier(callee) || !ROOTS.has(callee.text) || !chain.every((name) => MODIFIERS.has(name))) return;

	const kind: TestNode["kind"] = SUITES.has(callee.text) || chain.includes("describe") ? "suite" : "test";
	const body = ts.isBlock(fn.body) ? fn.body : undefined;
	return { kind, title: ts.isStringLiteralLike(titleArg) ? titleArg.text : titleArg.getText(sf), table, body };
}

// Builds the suite and test tree. Only calls that stand as their own statement in a block are
// collected, so removing one always leaves valid syntax.
function collect(sf: TS.SourceFile): TestNode[] {
	const roots: TestNode[] = [];
	const visit = (node: TS.Node, path: string[], out: TestNode[]) => {
		const standalone = ts.isExpressionStatement(node) && (ts.isBlock(node.parent) || ts.isSourceFile(node.parent));
		const found = standalone ? classify(node, sf) : undefined;
		if (!found) return void ts.forEachChild(node, (child) => visit(child, path, out));
		const entry: TestNode = { ...found, title: [...path, found.title], statement: node as TS.ExpressionStatement, children: [] };
		out.push(entry);
		if (entry.kind === "suite") ts.forEachChild(entry.statement.expression, (child) => visit(child, entry.title, entry.children));
	};
	visit(sf, [], roots);
	return roots;
}

const testsOf = (nodes: TestNode[]): TestNode[] => nodes.flatMap((node) => (node.kind === "test" ? [node] : testsOf(node.children)));
const suitesOf = (nodes: TestNode[]): TestNode[] => nodes.flatMap((node) => (node.kind === "suite" ? [node, ...suitesOf(node.children)] : []));
const lineStart = (text: string, pos: number) => text.lastIndexOf("\n", pos - 1) + 1;

// The range of a statement plus the comments directly above it, as whole lines when the
// statement has its lines to itself. Comments above the file's first statement are the file
// header and stay.
function statementRange(sf: TS.SourceFile, statement: TS.Statement): Edit {
	const { text } = sf;
	let start = statement.getStart(sf);
	if (statement !== sf.statements[0]) {
		for (const comment of (ts.getLeadingCommentRanges(text, statement.pos) ?? []).reverse()) {
			if (/\n[ \t]*\n/.test(text.slice(comment.end, start))) break;
			start = comment.pos;
		}
	}
	if (!text.slice(lineStart(text, start), start).trim()) start = lineStart(text, start);
	const eol = text.indexOf("\n", statement.end);
	const lineEnd = eol === -1 ? text.length : eol + 1;
	return { start, end: text.slice(statement.end, lineEnd).trim() ? statement.end : lineEnd };
}

// Removes the elements at `drop` with their commas and leaves the rest of the list as written.
// At least one element must stay.
function elementEdits(elements: TS.NodeArray<TS.Node>, drop: ReadonlySet<number>): Edit[] {
	const lastKept = elements.findLastIndex((_, i) => !drop.has(i));
	const edits = [...drop].filter((i) => i < lastKept).map((i) => ({ start: elements[i].pos, end: elements[i + 1].pos }));
	if (lastKept < elements.length - 1) edits.push({ start: elements[lastKept].end, end: elements[elements.length - 1].end });
	return edits;
}

// Applies removals from the end of the file backwards. Overlapping removals merge. Where a
// whole-line removal leaves two blank lines together, or a blank line against a block edge,
// one blank line goes.
function applyEdits(text: string, edits: Edit[]): string {
	const merged: Edit[] = [];
	for (const edit of [...edits].sort((a, b) => a.start - b.start)) {
		const last = merged.at(-1);
		if (last && edit.start <= last.end) last.end = Math.max(last.end, edit.end);
		else merged.push({ ...edit });
	}
	return merged.reduceRight((out, { start, end }) => {
		const wholeLines = start === lineStart(out, start) && out[end - 1] === "\n";
		out = out.slice(0, start) + out.slice(end);
		if (!wholeLines) return out;
		const nextEol = out.indexOf("\n", start);
		const nextLine = nextEol === -1 ? out.slice(start).trim() : out.slice(start, nextEol).trim();
		const prevStart = start > 0 ? lineStart(out, start - 1) : start;
		const prevLine = start > 0 ? out.slice(prevStart, start).trim() : "{";
		if (nextEol !== -1 && nextLine === "" && (prevLine === "" || /[{([]$/.test(prevLine))) return out.slice(0, start) + out.slice(nextEol + 1);
		if (start > 0 && prevLine === "" && /^[})\]]/.test(nextLine)) return out.slice(0, prevStart) + out.slice(start);
		return out;
	}, text);
}

function identifierCounts(sf: TS.SourceFile): Map<string, number> {
	const counts = new Map<string, number>();
	const visit = (node: TS.Node) => {
		if (ts.isIdentifier(node)) counts.set(node.text, (counts.get(node.text) ?? 0) + 1);
		ts.forEachChild(node, visit);
	};
	visit(sf);
	return counts;
}

// True when evaluating the expression cannot change anything, so deleting its declaration is safe.
function isPure(expr: TS.Expression): boolean {
	if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isNonNullExpression(expr) || ts.isPropertyAccessExpression(expr)) return isPure(expr.expression);
	if (ts.isPrefixUnaryExpression(expr)) return isPure(expr.operand);
	if (ts.isArrayLiteralExpression(expr)) return expr.elements.every(isPure);
	if (ts.isTemplateExpression(expr)) return expr.templateSpans.every((span) => isPure(span.expression));
	if (ts.isObjectLiteralExpression(expr)) {
		return expr.properties.every((p) => (ts.isPropertyAssignment(p) ? isPure(p.initializer) : ts.isShorthandPropertyAssignment(p) || ts.isMethodDeclaration(p)));
	}
	return isFunction(expr) || ts.isClassExpression(expr) || ts.isIdentifier(expr) || ts.isLiteralExpression(expr)
		|| [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(expr.kind);
}

// A non-exported helper declared at file level or directly in a suite body.
function helperOf(statement: TS.Statement): { name: string; pure: boolean } | undefined {
	if (ts.canHaveModifiers(statement) && ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return;
	if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) return { name: statement.name.text, pure: true };
	if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) return { name: statement.name.text, pure: true };
	if (ts.isVariableStatement(statement) && statement.declarationList.declarations.length === 1) {
		const [decl] = statement.declarationList.declarations;
		if (ts.isIdentifier(decl.name)) return { name: decl.name.text, pure: !decl.initializer || isPure(decl.initializer) };
	}
}

// Finds imports and helpers referenced nowhere else in the file, skipping names in `skip`.
// `edits` removes the removable ones. `leftover` names unused helpers whose initializer may
// have side effects, which stay for a human to judge.
function findUnused(sf: TS.SourceFile, skip: ReadonlySet<string> = new Set()) {
	const counts = identifierCounts(sf);
	const isUnused = (name: string) => counts.get(name) === 1 && !skip.has(name);
	const removable: string[] = [];
	const leftover: string[] = [];
	const edits: Edit[] = [];

	for (const decl of sf.statements.filter(ts.isImportDeclaration)) {
		const clause = decl.importClause;
		if (!clause) continue;
		const bindings = clause.namedBindings;
		const named = bindings && ts.isNamedImports(bindings) ? bindings.elements : undefined;
		const bindingNames = !bindings ? [] : ts.isNamedImports(bindings) ? bindings.elements.map((e) => e.name) : [bindings.name];
		const drop = new Set([clause.name, ...bindingNames].flatMap((n) => (n && isUnused(n.text) ? [n.text] : [])));
		if (!drop.size) continue;
		removable.push(...drop);

		const defaultGone = !clause.name || drop.has(clause.name.text);
		const bindingsGone = bindingNames.every((n) => drop.has(n.text));
		if (defaultGone && bindingsGone) {
			edits.push(statementRange(sf, decl));
		} else if (bindingsGone && clause.name && bindings) {
			edits.push({ start: clause.name.end, end: bindings.end });
		} else {
			if (defaultGone && clause.name && bindings) edits.push({ start: clause.name.getStart(sf), end: bindings.getStart(sf) });
			if (named) edits.push(...elementEdits(named, new Set(named.flatMap((e, i) => (drop.has(e.name.text) ? [i] : [])))));
		}
	}

	const scopes = [sf.statements, ...suitesOf(collect(sf)).flatMap((suite) => (suite.body ? [suite.body.statements] : []))];
	for (const statement of scopes.flat()) {
		const helper = helperOf(statement);
		if (!helper || !isUnused(helper.name)) continue;
		if (helper.pure) {
			removable.push(helper.name);
			edits.push(statementRange(sf, statement));
		} else leftover.push(helper.name);
	}
	return { removable, leftover, edits };
}

function list(files: string[]) {
	return files.map((file) => {
		const sf = parse(file, readFileSync(file, "utf8"));
		const tests = testsOf(collect(sf));
		return {
			file: repoPath(file),
			tests: tests.map((test) => ({
				title: test.title,
				line: sf.getLineAndCharacterOfPosition(test.statement.getStart(sf)).line + 1,
				...(test.table ? { rows: test.table.elements.length } : {}),
				...(tests.filter((other) => sameTitle(other.title, test.title)).length > 1 ? { ambiguous: true } : {}),
			})),
		};
	});
}

function tally(dir: string) {
	const files = readFileSync(join(dir, "files.txt"), "utf8").split("\n").filter(Boolean).map(repoPath);
	const readAll = <T>(sub: string): T[] =>
		existsSync(join(dir, sub))
			? readdirSync(join(dir, sub)).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, sub, f), "utf8")))
			: [];
	const pass = (sub: string) => {
		const runs = readAll<VoteFile>(sub);
		return {
			covered: new Set(runs.flatMap((run) => run.files.map(repoPath))),
			votes: new Map(runs.flatMap((run) => run.votes).map((vote) => [key(vote), { ...vote, file: repoPath(vote.file) }])),
		};
	};
	const first = pass("pass1");
	const second = pass("pass2");
	const rulings = new Map(readAll<Ruling[]>("tiebreak").flat().map((ruling) => [key(ruling), ruling]));

	const flagged = new Set([...first.votes.values()].map((vote) => vote.file));
	const missingPass1 = files.filter((file) => !first.covered.has(file));
	const needsPass2 = [...flagged].filter((file) => !second.covered.has(file));
	const settled = (vote: Vote) => flagged.has(vote.file) && second.covered.has(vote.file);

	const agreed = [...first.votes].filter(([k, vote]) => settled(vote) && second.votes.has(k)).map(([, vote]) => vote);
	const disputed = [
		...[...first.votes].filter(([k]) => !second.votes.has(k)).map(([, vote]) => ({ ...vote, pass: 1 })),
		...[...second.votes].filter(([k]) => !first.votes.has(k)).map(([, vote]) => ({ ...vote, pass: 2 })),
	].filter(settled);
	const unresolved = disputed.filter((vote) => !rulings.has(key(vote)));
	const deletions = [...agreed, ...disputed.filter((vote) => rulings.get(key(vote))?.verdict === "delete")];

	writeFileSync(join(dir, "needs-pass2.txt"), needsPass2.map((file) => `${file}\n`).join(""));
	writeFileSync(join(dir, "disputed.json"), JSON.stringify(unresolved, null, 2));
	writeFileSync(join(dir, "deletions.json"), JSON.stringify(deletions, null, 2));

	const next = missingPass1.length ? "pass1" : needsPass2.length ? "pass2" : unresolved.length ? "tiebreak" : "apply";
	return { files: files.length, missingPass1, needsPass2: needsPass2.length, agreed: agreed.length, disputed: disputed.length, unresolved: unresolved.length, deletions: deletions.length, next };
}

function apply(path: string) {
	const refs: TestRef[] = JSON.parse(readFileSync(path, "utf8"));
	const report = {
		deletedTests: 0,
		deletedRows: 0,
		deletedFiles: [] as string[],
		unmatched: [] as (TestRef & { problem: string })[],
		cleaned: {} as Record<string, string[]>,
		leftoverUnused: {} as Record<string, string[]>,
	};

	for (const [file, fileRefs] of Map.groupBy(refs, (ref) => repoPath(ref.file))) {
		const text = readFileSync(file, "utf8");
		const sf = parse(file, text);
		const roots = collect(sf);
		const tests = testsOf(roots);
		const doomed = new Set<TestNode>();
		const rows = new Map<TestNode, Set<number>>();

		for (const ref of fileRefs) {
			const matches = tests.filter((test) => sameTitle(test.title, ref.title));
			const [test] = matches;
			if (matches.length !== 1) report.unmatched.push({ ...ref, problem: matches.length ? "ambiguous title" : "no test with this title" });
			else if (ref.row === undefined) doomed.add(test);
			else if (!test.table || ref.row < 0 || ref.row >= test.table.elements.length) report.unmatched.push({ ...ref, problem: "no such table row" });
			else rows.set(test, (rows.get(test) ?? new Set()).add(ref.row));
		}
		for (const [test, drop] of rows) if (drop.size === test.table?.elements.length) doomed.add(test);

		// A suite whose tests all go is removed whole, hooks included.
		const gone = (node: TestNode): boolean => (node.kind === "test" ? doomed.has(node) : node.children.length > 0 && node.children.every(gone));
		const edits: Edit[] = [];
		const visit = (node: TestNode) => {
			if (gone(node)) edits.push(statementRange(sf, node.statement));
			else if (node.kind === "suite") node.children.forEach(visit);
			else {
				const drop = rows.get(node);
				if (drop && node.table) {
					edits.push(...elementEdits(node.table.elements, drop));
					report.deletedRows += drop.size;
				}
			}
		};
		roots.forEach(visit);
		report.deletedTests += doomed.size;

		if (roots.length > 0 && roots.every(gone)) {
			unlinkSync(file);
			report.deletedFiles.push(file);
			continue;
		}
		if (!edits.length) continue;

		// Remove only what the deletions made unused. Names that were unused before stay.
		const before = findUnused(sf);
		const baseline = new Set([...before.removable, ...before.leftover]);
		let next = applyEdits(text, edits);
		const cleaned: string[] = [];
		let leftover: string[] = [];
		for (;;) {
			const found = findUnused(parse(file, next), baseline);
			leftover = found.leftover;
			if (!found.edits.length) break;
			cleaned.push(...found.removable);
			next = applyEdits(next, found.edits);
		}
		writeFileSync(file, next);
		if (cleaned.length) report.cleaned[file] = cleaned;
		if (leftover.length) report.leftoverUnused[file] = leftover;
	}
	return report;
}

const [command, ...args] = process.argv.slice(2);
if (command === "list") console.log(JSON.stringify(list(args), null, 2));
else if (command === "tally" && args[0]) console.log(JSON.stringify(tally(args[0]), null, 2));
else if (command === "apply" && args[0]) {
	const report = apply(args[0]);
	console.log(JSON.stringify(report, null, 2));
	if (report.unmatched.length) process.exitCode = 1;
} else {
	console.error("usage: node prune.ts list <file...> | tally <state-dir> | apply <deletions.json>");
	process.exitCode = 2;
}
