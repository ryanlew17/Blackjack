// @req REQ-2026-012: enforce layer boundaries and resolvable imports without a build.
/// <reference types="vite/client" />
import ts from "typescript";
import { describe, expect, it } from "vitest";
import research from "../docs/design/contest-trumps.md?raw";

const sources = import.meta.glob<string>(
  ["./**/*.ts", "./**/*.tsx", "./**/*.css", "!./**/*.test.ts", "!./**/*.d.ts"],
  { query: "?raw", import: "default", eager: true },
);
const modules = Object.entries(sources)
  .filter(([file]) => /\.tsx?$/.test(file))
  .map(([file, source]) => ({
    file,
    name: file.slice(2),
    ast: ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    ),
  }));
function resolveImport(file: string, spec: string): string {
  return "." + new URL(spec, `file:///${file.slice(2)}`).pathname;
}

describe("module architecture", () => {
  it("resolves every production import after the classic relocation", () => {
    for (const { file, ast } of modules) {
      for (const node of ast.statements) {
        if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node))
          continue;
        const spec = node.moduleSpecifier;
        if (!spec || !ts.isStringLiteral(spec) || !spec.text.startsWith("."))
          continue;
        const path = resolveImport(file, spec.text);
        expect(
          [path, `${path}.ts`, `${path}.tsx`, `${path}/index.ts`].some(
            (candidate) => Object.hasOwn(sources, candidate),
          ),
          `${file}: ${spec.text}`,
        ).toBe(true);
      }
    }
  });
  it("keeps domain pure, modes independent and infrastructure outside UI", () => {
    for (const { file, name, ast } of modules) {
      for (const node of ast.statements) {
        if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node))
          continue;
        const spec = node.moduleSpecifier;
        if (!spec || !ts.isStringLiteral(spec)) continue;
        const target = spec.text.startsWith(".")
          ? resolveImport(file, spec.text).slice(2)
          : spec.text;
        if (name.startsWith("domain/")) {
          expect(target.startsWith("domain/"), `${name} -> ${target}`).toBe(
            true,
          );
          if (name.includes("/classic/"))
            expect(target).not.toContain("/contest/");
          if (name.includes("/contest/"))
            expect(target).not.toContain("/classic/");
        }
        if (name.startsWith("application/"))
          expect(target).not.toMatch(/^presentation\//);
        if (name.startsWith("infrastructure/"))
          expect(target).not.toMatch(/^(application|presentation)\/|^react/);
      }
      if (name.startsWith("domain/")) {
        const visit = (node: ts.Node) => {
          if (ts.isIdentifier(node))
            expect(
              [
                "window",
                "document",
                "localStorage",
                "sessionStorage",
                "navigator",
                "fetch",
              ],
              name,
            ).not.toContain(node.text);
          ts.forEachChild(node, visit);
        };
        visit(ast);
      }
    }
  });
  // @req REQ-2026-014/018: trace real imports; playable contest is now intentional.
  it("keeps unimplemented contest features and test helpers outside the production entry", () => {
    const pending = ["./main.tsx"];
    const visited = new Set<string>();
    while (pending.length) {
      const file = pending.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      expect(file).not.toMatch(
        /\/contest\/codex\/|\/prototype[/.]|\.test\.|\/(?:[^/]*TestHelpers|testHelpers)\./,
      );
      // @req REQ-2026-025: exact admission; experimental presets/catalog/fixtures stay excluded.
      if (/\/contest\/(presets|trumps)\//.test(file))
        expect([
          "./domain/contest/presets/s2.ts",
          "./domain/contest/presets/resources.ts",
          "./domain/contest/trumps/admitted.ts",
          "./domain/contest/trumps/ids.ts",
          "./domain/contest/trumps/numberDefinitions.ts",
          "./domain/contest/trumps/interactionDefinitions.ts",
        ]).toContain(file);
      // @req REQ-2026-020: admit only the completed no-trump baseline.
      if (file.includes("/contest/ai/"))
        expect(file).toBe("./domain/contest/ai/policy.ts");
      const module = modules.find((entry) => entry.file === file);
      if (!module) {
        expect(file).toMatch(/\.css$/);
        continue;
      }
      const visit = (node: ts.Node) => {
        let spec: ts.Expression | undefined;
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
          spec = node.moduleSpecifier;
        if (ts.isCallExpression(node)) {
          if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
            expect(node.arguments).toHaveLength(1);
            spec = node.arguments[0];
          }
          // Non-literal/glob imports cannot be proven isolated by this check.
          expect(node.expression.getText(module.ast)).not.toMatch(
            /^import\.meta\.glob/,
          );
        }
        if (spec) {
          expect(ts.isStringLiteral(spec)).toBe(true);
          if (ts.isStringLiteral(spec) && spec.text.startsWith(".")) {
            const path = resolveImport(file, spec.text);
            const resolved = [
              path,
              `${path}.ts`,
              `${path}.tsx`,
              `${path}/index.ts`,
            ].find((candidate) => Object.hasOwn(sources, candidate));
            expect(resolved, `${file}: ${spec.text}`).toBeDefined();
            pending.push(resolved!);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(module.ast);
    }
    expect(visited).toContain("./application/classic/useGame.ts");
    expect(visited).toContain("./infrastructure/classic/save.ts");
    expect(visited).toContain("./application/contest/useContest.ts");
    expect(visited).toContain("./application/contest/controller.ts");
    expect(visited).toContain("./domain/contest/ai/policy.ts");
    expect(visited).toContain("./domain/contest/presets/s2.ts");
    expect(visited).toContain("./domain/contest/trumps/admitted.ts");
    expect(visited).toContain("./presentation/shell/ModeSelect.tsx");
    expect(visited).toContain("./presentation/contest/table/ContestTable.tsx");
  });
  // @req REQ-2026-021/025: planned identities and explicit execution admission agree.
  it("admits the 51 planned definitions and two additions while reserving Skill Revival", async () => {
    const { TRUMP_CATALOG } = await import("./domain/contest/trumps/catalog");
    const { isTrumpId, TRUMP_IDS } =
      await import("./domain/contest/trumps/ids");
    const rows = research
      .split("\n")
      .map((line) =>
        line
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim()),
      )
      .filter(
        (cells) => cells.length === 7 && /^\x60[^\x60]+\x60$/.test(cells[0]),
      );
    const ids = rows.map((row) => row[0].slice(1, -1));
    expect(ids).toHaveLength(51);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(TRUMP_IDS.slice(0, 51));
    expect(TRUMP_IDS.slice(51)).toEqual([
      "regret",
      "skill-revival",
      "sudden-death",
    ]);
    expect(TRUMP_CATALOG["skill-revival"].playable).toBe(false);
    expect(research).not.toContain("| 最早出现 |");
    for (const row of rows) {
      const id = row[0].slice(1, -1);
      const copies = row[3].split("/").map(Number);
      expect(copies).toHaveLength(5);
      expect(copies.every((n) => Number.isSafeInteger(n) && n >= 0)).toBe(true);
      expect(isTrumpId(id)).toBe(true);
      if (isTrumpId(id)) expect(TRUMP_CATALOG[id].playable).toBe(true);
    }
  });
});
