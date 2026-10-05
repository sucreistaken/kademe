import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * A transaction holds one of the pool's few connections (src/db/index.ts,
 * max 5) until it ends. A read on the global `db` from inside its callback
 * waits for a second connection: enough simultaneous requests and every
 * connection is a transaction waiting for another one, so every query in the
 * app hangs (Task 8 review, Critical; repo-wide audit, fix round 2).
 *
 * This lint-style check reads ALL of src (tests excluded) and refuses, inside
 * any `<x>.transaction(callback)`:
 *  - the identifier `db` itself;
 *  - a call that reaches the global `db`: a function whose body uses it
 *    (directly or through other functions, followed across imports and through
 *    module objects such as `m.library.usage(...)`), or a function whose
 *    executor parameter defaults to `db` (`x: Executor = db`) called without
 *    that argument.
 * Calls it cannot resolve (packages, dynamic values) are not judged.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const SRC = path.join(ROOT, "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts") && name !== "test-fake-db.ts" ? [full] : [];
  });
}

type Fn = { file: string; name: string; body: ts.Node; executorIndex: number; usesDb: boolean };
type Module = {
  file: string;
  source: ts.SourceFile;
  locals: Map<string, Fn>;
  imports: Map<string, { from: string | null; name: string }>;
  reexports: Array<{ from: string | null; names: Map<string, string> | null }>;
};

const isDb = (node: ts.Node): node is ts.Identifier =>
  ts.isIdentifier(node) && node.text === "db" && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) && !ts.isImportSpecifier(node.parent);

function resolveModule(fromFile: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? path.join(SRC, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(fromFile), spec) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function fnOf(file: string, name: string, fn: ts.FunctionLikeDeclaration): Fn | null {
  if (!fn.body) return null;
  return { file, name, body: fn.body, executorIndex: fn.parameters.findIndex((p) => !!p.initializer && isDb(p.initializer)), usesDb: false };
}

function readModule(file: string, text = readFileSync(file, "utf8")): Module {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const m: Module = { file, source, locals: new Map(), imports: new Map(), reexports: [] };
  for (const st of source.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) {
      const fn = fnOf(file, st.name.text, st);
      if (fn) m.locals.set(st.name.text, fn);
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
          const fn = fnOf(file, d.name.text, d.initializer);
          if (fn) m.locals.set(d.name.text, fn);
        }
      }
    } else if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) {
      const from = resolveModule(file, st.moduleSpecifier.text);
      for (const el of st.importClause.namedBindings.elements) m.imports.set(el.name.text, { from, name: (el.propertyName ?? el.name).text });
    } else if (ts.isExportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
      const from = resolveModule(file, st.moduleSpecifier.text);
      const names = st.exportClause && ts.isNamedExports(st.exportClause) ? new Map(st.exportClause.elements.map((el) => [el.name.text, (el.propertyName ?? el.name).text])) : null;
      m.reexports.push({ from, names });
    }
  }
  return m;
}

function analyse(extra: Array<{ file: string; text: string }> = []) {
  const files = walk(SRC);
  const modules = new Map<string, Module>(files.map((f) => [f, readModule(f)]));
  for (const e of extra) modules.set(e.file, readModule(e.file, e.text));

  const exported = (file: string | null, name: string, depth = 0): Fn | null => {
    if (!file || depth > 5) return null;
    const m = modules.get(file);
    if (!m) return null;
    const local = m.locals.get(name);
    if (local) return local;
    const imported = m.imports.get(name);
    if (imported) return exported(imported.from, imported.name, depth + 1);
    for (const r of m.reexports) {
      if (r.names) {
        const original = r.names.get(name);
        if (original) return exported(r.from, original, depth + 1);
      } else {
        const found = exported(r.from, name, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };

  // Module objects: `const x = { library: { usage: hiringLibraryUsage }, attempts: { async terminate() {} } }`.
  // Every nested property is filed under its last two names ("library.usage"), so `m.library.usage(...)` resolves to all of them.
  const methods = new Map<string, Fn[]>();
  const file = (key: string, fn: Fn | null) => {
    if (!fn) return;
    methods.set(key, [...(methods.get(key) ?? []), fn]);
  };
  for (const m of modules.values()) {
    const visitObject = (obj: ts.ObjectLiteralExpression, parent: string) => {
      for (const p of obj.properties) {
        const name = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;
        if (!name) continue;
        const key = `${parent}.${name}`;
        if (ts.isMethodDeclaration(p)) file(key, fnOf(m.file, key, p));
        else if (ts.isPropertyAssignment(p)) {
          const v = p.initializer;
          if (ts.isObjectLiteralExpression(v)) visitObject(v, name);
          else if (ts.isIdentifier(v)) file(key, exported(m.file, v.text));
          else if (ts.isArrowFunction(v) || ts.isFunctionExpression(v)) file(key, fnOf(m.file, key, v));
        } else if (ts.isShorthandPropertyAssignment(p)) file(key, exported(m.file, name));
      }
    };
    for (const st of m.source.statements) {
      if (!ts.isVariableStatement(st)) continue;
      for (const d of st.declarationList.declarations) if (d.initializer && ts.isObjectLiteralExpression(d.initializer) && ts.isIdentifier(d.name)) visitObject(d.initializer, d.name.text);
    }
  }

  const targets = (call: ts.CallExpression, inFile: string): Fn[] => {
    const callee = call.expression;
    if (ts.isIdentifier(callee)) {
      const fn = exported(inFile, callee.text);
      return fn ? [fn] : [];
    }
    if (ts.isPropertyAccessExpression(callee)) {
      let owner: ts.Expression = callee.expression;
      while (ts.isNonNullExpression(owner) || ts.isParenthesizedExpression(owner)) owner = owner.expression;
      const ownerName = ts.isPropertyAccessExpression(owner) ? owner.name.text : ts.isIdentifier(owner) ? owner.text : null;
      return ownerName ? (methods.get(`${ownerName}.${callee.name.text}`) ?? []) : [];
    }
    return [];
  };
  const callUsesDb = (call: ts.CallExpression, inFile: string) =>
    targets(call, inFile).some((fn) => fn.usesDb || (fn.executorIndex >= 0 && call.arguments.length <= fn.executorIndex));

  const all = [...new Set([...[...modules.values()].flatMap((m) => [...m.locals.values()]), ...[...methods.values()].flat()])];
  const bodyUsesDb = (fn: Fn) => {
    let found = false;
    const visit = (n: ts.Node) => {
      if (found) return;
      if (isDb(n) || (ts.isCallExpression(n) && callUsesDb(n, fn.file))) found = true;
      else ts.forEachChild(n, visit);
    };
    visit(fn.body);
    return found;
  };
  for (let changed = true; changed; ) {
    changed = false;
    for (const fn of all) {
      if (!fn.usesDb && bodyUsesDb(fn)) {
        fn.usesDb = true;
        changed = true;
      }
    }
  }

  const problems: string[] = [];
  for (const m of modules.values()) {
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "transaction") {
        const callback = n.arguments[0];
        if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
          const inside = (x: ts.Node) => {
            const where = `${path.relative(ROOT, m.file)}:${m.source.getLineAndCharacterOfPosition(x.getStart()).line + 1}`;
            if (isDb(x)) problems.push(`${where} global db inside a transaction`);
            if (ts.isCallExpression(x) && callUsesDb(x, m.file)) problems.push(`${where} ${x.expression.getText()}(...) reaches the global db inside a transaction`);
            ts.forEachChild(x, inside);
          };
          ts.forEachChild(callback, inside);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(m.source);
  }
  return { problems, exported, methods, modules };
}

describe("transactions use only their own connection (all of src)", () => {
  const { problems, exported, methods, modules } = analyse();

  it("reads all of src and knows the helpers that reach the global db (the check would be blind otherwise)", () => {
    expect(modules.size).toBeGreaterThan(200);
    const uses = (file: string, name: string) => exported(path.join(SRC, file), name)?.usesDb;
    expect(uses("lib/candidate-context.ts", "currentAttempt")).toBe(true);
    expect(uses("lib/candidate-context.ts", "hasConsented")).toBe(true);
    expect(uses("lib/candidate-media.ts", "resolveOwnedMedia")).toBe(true);
    // Through a module object: the core asks every module `m.library.usage(...)`.
    expect((methods.get("library.usage") ?? []).length).toBeGreaterThan(0);
  });

  it("finds planted global reads inside a transaction: direct, imported, and through a module object (positive control)", () => {
    const planted = path.join(SRC, "solutions/hiring/server/planted.ts");
    const text = [
      `import { db } from "@/db";`,
      `import { currentAttempt } from "@/lib/candidate-context";`,
      `import { loadVersionContent } from "./content";`,
      `export async function f(h, modules) {`,
      `  return db.transaction(async (tx) => {`,
      `    await currentAttempt(h.assessment);`,
      `    await loadVersionContent(o, v);`,
      `    for (const m of modules) await m.library!.usage(o, refs, null);`,
      `    return db.select();`,
      `  });`,
      `}`,
    ].join("\n");
    const found = analyse([{ file: planted, text }]).problems.filter((p) => p.includes("planted.ts"));
    expect(found.some((p) => p.includes("currentAttempt("))).toBe(true);
    expect(found.some((p) => p.includes("loadVersionContent("))).toBe(true);
    expect(found.some((p) => p.includes("m.library!.usage("))).toBe(true);
    expect(found.some((p) => p.includes("global db inside"))).toBe(true);
  });

  it("finds no global db read inside any transaction callback in src", () => {
    expect(problems).toEqual([]);
  });
});
