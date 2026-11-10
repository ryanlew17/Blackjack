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
  // @req REQ-2026-028: AI imports observation types and legal queries, not authority or RNG.
  it("keeps AI decision inputs away from authoritative state and random ports", () => {
    const allowed: Record<string, readonly string[]> = {
      "../engine/types": [
        "MatchObservation",
        "MatchCommand",
        "MatchTransitionView",
        "RoundEventView",
      ],
      "../engine/effectTypes": ["TrumpInstance"],
      "../types": ["NumberValue", "PlayerId"],
      "../random": ["seededRandom"],
      "../simulation": ["createSimulation", "Simulation"],
      "../engine/legalActions": ["legalActions", "ordinaryHitAvailable"],
      "../engine/trumpLegality": ["legalTrumpCommands"],
      "../engine/skills": ["legalSkillCommands"],
      "../immutable": ["freezeData"],
    };
    for (const { file, ast } of modules.filter((m) =>
      m.file.includes("/contest/ai/"),
    )) {
      for (const node of ast.statements) {
        if (!ts.isImportDeclaration(node)) continue;
        const spec = node.moduleSpecifier;
        if (!ts.isStringLiteral(spec)) continue;
        if (spec.text.startsWith("./")) continue;
        const names = allowed[spec.text];
        expect(names, `${file}: ${spec.text}`).toBeDefined();
        const bindings = node.importClause?.namedBindings;
        expect(bindings && ts.isNamedImports(bindings)).toBe(true);
        expect(node.importClause?.name).toBeUndefined();
        if (bindings && ts.isNamedImports(bindings))
          for (const element of bindings.elements)
            expect(names).toContain(
              (element.propertyName ?? element.name).text,
            );
      }
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          expect(node.expression.kind, file).not.toBe(
            ts.SyntaxKind.ImportKeyword,
          );
          expect(node.expression.getText(ast), file).not.toMatch(
            /^(Math\.random|Date\.now|crypto\.|require$|import\.meta\.glob)/,
          );
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
  });
  // @req REQ-2026-028: only the opaque simulation facade can cross its module boundary.
  it("keeps hypothetical authority private to simulation", () => {
    for (const { file, ast } of modules) {
      for (const node of ast.statements) {
        if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node))
          continue;
        const spec = node.moduleSpecifier;
        if (!spec || !ts.isStringLiteral(spec) || !spec.text.startsWith("."))
          continue;
        const target = resolveImport(file, spec.text);
        if (
          target.includes("/contest/simulation/") &&
          !file.includes("/contest/simulation/")
        )
          expect(target).toBe("./domain/contest/simulation/index");
      }
    }
    const facade = modules.find(
      (m) => m.file === "./domain/contest/simulation/index.ts",
    )!;
    for (const node of facade.ast.statements) {
      if (ts.isExportDeclaration(node))
        throw new Error(
          "Simulation facade must not re-export internal authority",
        );
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
        /\/contest\/(?:codex)\/|\/prototype[/.]|\.test\.|\/(?:[^/]*TestHelpers|testHelpers)\./,
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
          "./domain/contest/trumps/skillDefinitions.ts",
        ]).toContain(file);
      // @req REQ-2026-028: exact admission of completed search and opaque simulation.
      if (file.includes("/contest/ai/"))
        expect(
          [
            "policy",
            "candidates",
            "memory",
            "belief",
            "evaluation",
            "heuristic",
            "search",
            "steps",
          ].map((name) => `./domain/contest/ai/${name}.ts`),
        ).toContain(file);
      if (file.includes("/contest/simulation/"))
        expect(
          ["index", "hydrate", "undo"].map(
            (name) => `./domain/contest/simulation/${name}.ts`,
          ),
        ).toContain(file);
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
    expect(visited).toContain("./domain/contest/ai/search.ts");
    expect(visited).toContain("./application/contest/decision.ts");
    expect(visited).toContain("./domain/contest/presets/s2.ts");
    expect(visited).toContain("./domain/contest/trumps/admitted.ts");
    expect(visited).toContain("./presentation/shell/ModeSelect.tsx");
    expect(visited).toContain("./presentation/contest/table/ContestTable.tsx");
  });
  // @req REQ-2026-021/025: planned identities and explicit execution admission agree.
  it("admits the 51 planned definitions and all three additions", async () => {
    const { TRUMP_CATALOG } = await import("./domain/contest/trumps/catalog");
    const { isTrumpId, TRUMP_IDS } =
      await import("./domain/contest/trumps/ids");
    // @req REQ-2026-029: the baseline table includes a player-description column.
    const rows = research
      .split("\n")
      .map((line) =>
        line
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim()),
      )
      .filter(
        (cells) => cells.length === 8 && /^\x60[^\x60]+\x60$/.test(cells[0]),
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
    expect(TRUMP_CATALOG["skill-revival"].playable).toBe(true);
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
