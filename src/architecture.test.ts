// @req REQ-2026-012: enforce layer boundaries and resolvable imports without a build.
/// <reference types="vite/client" />
import ts from "typescript";
import { describe, expect, it } from "vitest";
import research from "../docs/contest-research/candidates.md?raw";

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
        /\/contest\/(codex|presets|trumps|ai)\/|\.test\.|\/testHelpers\./,
      );
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
    expect(visited).toContain("./presentation/shell/ModeSelect.tsx");
    expect(visited).toContain("./presentation/contest/table/ContestTable.tsx");
  });
  it("keeps research rows aligned with the data directory without declaring admission", async () => {
    const { TRUMP_CATALOG } = await import("./domain/contest/trumps/catalog");
    const { CANDIDATE_AVAILABILITY } =
      await import("./domain/contest/presets/experimental");
    const { DIFFICULTIES } = await import("./domain/contest/types");
    const { isTrumpId, TRUMP_IDS } =
      await import("./domain/contest/trumps/ids");
    const rows = research
      .split("\n")
      .filter((line) => /\d\/\d\/\d\/\d\/\d/.test(line))
      .map((line) =>
        line
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim()),
      );
    expect(rows.map((row) => row[0])).toEqual([...TRUMP_IDS]);
    for (const row of rows) {
      const id = row[0];
      if (!isTrumpId(id)) throw new Error(id);
      expect(
        DIFFICULTIES.map((d) => CANDIDATE_AVAILABILITY[id].copiesPerSide[d]),
      ).toEqual(row[5].split("/").map(Number));
      expect(TRUMP_CATALOG[id].playable).toBe(false);
    }
  });
});
