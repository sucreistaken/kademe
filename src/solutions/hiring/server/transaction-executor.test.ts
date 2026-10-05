import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * A transaction holds one of the pool's few connections until it ends. A read
 * on the global `db` from inside its callback waits for a second connection:
 * enough simultaneous requests and every connection is a transaction waiting
 * for another one, so every query in the app hangs (Task 8 review, Critical).
 *
 * This lint-style check reads the hiring server code (and the core helpers it
 * calls) and refuses, inside any `db.transaction(...)` callback:
 *  - the identifier `db` itself;
 *  - a call to a function that uses the global `db` in its body (directly or
 *    through another such function), e.g. `currentAttempt(` or `hasConsented(`;
 *  - a call to a function whose executor parameter defaults to `db`
 *    (`x: Executor = db`) without passing that argument.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const HIRING_SERVER = path.join(ROOT, "src/solutions/hiring/server");
const scanned = readdirSync(HIRING_SERVER)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "test-fake-db.ts")
  .map((f) => path.join(HIRING_SERVER, f));
/** Core helpers the hiring server imports; read so their use of `db` is known. */
const helpers = [
  "src/lib/auth.ts",
  "src/lib/candidate-context.ts",
  "src/lib/candidate-media.ts",
  "src/server/library.ts",
  "src/server/library-write.ts",
  "src/server/settings.ts",
].map((f) => path.join(ROOT, f));

type Fn = { name: string; file: string; body: ts.Node; executorIndex: number; usesDb: boolean };

const parse = (file: string) => ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
const isDb = (node: ts.Node): node is ts.Identifier => ts.isIdentifier(node) && node.text === "db";

function collectFunctions(file: string, source: ts.SourceFile, into: Map<string, Fn[]>) {
  const add = (name: string, fn: ts.FunctionLikeDeclaration) => {
    if (!fn.body) return;
    const executorIndex = fn.parameters.findIndex((p) => !!p.initializer && isDb(p.initializer));
    const list = into.get(name) ?? [];
    list.push({ name, file, body: fn.body, executorIndex, usesDb: false });
    into.set(name, list);
  };
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) add(statement.name.text, statement);
    if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) add(d.name.text, d.initializer);
      }
    }
  }
}

function calleeName(call: ts.CallExpression): string | null {
  return ts.isIdentifier(call.expression) ? call.expression.text : null;
}

/** True when this call reaches the global `db` (by body, or by leaving the executor argument to its default). */
function callUsesDb(call: ts.CallExpression, fns: Map<string, Fn[]>): boolean {
  const name = calleeName(call);
  if (!name) return false;
  return (fns.get(name) ?? []).some((fn) => fn.usesDb || (fn.executorIndex >= 0 && call.arguments.length <= fn.executorIndex));
}

function bodyUsesDb(node: ts.Node, fns: Map<string, Fn[]>): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (isDb(n) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)) found = true;
    else if (ts.isCallExpression(n) && callUsesDb(n, fns)) found = true;
    else ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function analyse() {
  const fns = new Map<string, Fn[]>();
  const sources = [...scanned, ...helpers].map((file) => ({ file, source: parse(file) }));
  for (const { file, source } of sources) collectFunctions(file, source, fns);
  // Fixpoint: a function that calls a db-using function uses db too.
  for (let changed = true; changed; ) {
    changed = false;
    for (const list of fns.values()) {
      for (const fn of list) {
        if (!fn.usesDb && bodyUsesDb(fn.body, fns)) {
          fn.usesDb = true;
          changed = true;
        }
      }
    }
  }
  const problems: string[] = [];
  for (const { file, source } of sources.filter((s) => scanned.includes(s.file))) {
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "transaction" && isDb(n.expression.expression)) {
        const callback = n.arguments[0];
        if (callback) {
          const inside = (m: ts.Node) => {
            const where = `${path.relative(ROOT, file)}:${source.getLineAndCharacterOfPosition(m.getStart()).line + 1}`;
            if (isDb(m) && !(ts.isPropertyAccessExpression(m.parent) && m.parent.name === m)) problems.push(`${where} global db inside a transaction`);
            if (ts.isCallExpression(m) && callUsesDb(m, fns)) problems.push(`${where} ${m.expression.getText()}(...) reaches the global db inside a transaction`);
            ts.forEachChild(m, inside);
          };
          ts.forEachChild(callback, inside);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(source);
  }
  return { problems, fns };
}

describe("hiring server transactions use only their own connection", () => {
  const { problems, fns } = analyse();

  it("knows the core helpers that read the global db (the check would be blind otherwise)", () => {
    const uses = (name: string) => (fns.get(name) ?? []).some((f) => f.usesDb);
    expect(uses("currentAttempt")).toBe(true);
    expect(uses("hasConsented")).toBe(true);
    expect(uses("resolveOwnedMedia")).toBe(true);
    expect(scanned.some((f) => f.endsWith("candidate.ts"))).toBe(true);
  });

  it("finds a planted global read inside a transaction (positive control)", () => {
    const file = path.join(HIRING_SERVER, "planted.ts");
    const source = ts.createSourceFile(file, `async function f(h) { return db.transaction(async (tx) => { await currentAttempt(h.assessment); return loadVersionContent(o, v); }); }`, ts.ScriptTarget.Latest, true);
    const found: string[] = [];
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && callUsesDb(n, fns)) found.push(n.expression.getText());
      ts.forEachChild(n, visit);
    };
    visit(source);
    expect(found).toEqual(expect.arrayContaining(["currentAttempt", "loadVersionContent"]));
  });

  it("finds no global db read inside any db.transaction callback of src/solutions/hiring/server", () => {
    expect(problems).toEqual([]);
  });
});
