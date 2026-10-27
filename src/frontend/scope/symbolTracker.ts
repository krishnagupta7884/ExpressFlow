import { File as BabelFile } from "@babel/types";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { RouterDeclaration, RouterKind, SourceLocation } from "../../shared/types/manifest";

export interface SymbolTable {
  expressImportNames: Set<string>;        // e.g. "express"
  routerImportNames: Set<string>;         // e.g. "Router" (from { Router } from 'express')
  routerSymbols: Map<string, RouterKind>; // identifier name -> "APPLICATION" | "ROUTER"
  routerDeclarations: RouterDeclaration[];
}

function toSourceLocation(loc: t.SourceLocation | null | undefined): SourceLocation {
  if (!loc) {
    return {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 },
    };
  }
  return {
    start: { line: loc.start.line, column: loc.start.column },
    end: { line: loc.end.line, column: loc.end.column },
  };
}

/**
 * Unwinds method chaining (e.g. Router().use(...).use(...)) down to the root expression.
 * Halts if the call is itself a Router instantiation (e.g. express.Router() or Router()).
 */
function unwrapChainedCall(node: t.Expression): t.Expression {
  let curr = node;
  while (
    t.isCallExpression(curr) &&
    t.isMemberExpression(curr.callee) &&
    t.isIdentifier(curr.callee.property) &&
    curr.callee.property.name !== "Router"
  ) {
    curr = curr.callee.object as t.Expression;
  }
  return curr;
}

/**
 * Scans an AST to discover Express imports and instances (app and routers).
 */
export function trackExpressSymbols(ast: BabelFile): SymbolTable {
  const expressImportNames = new Set<string>();
  const routerImportNames = new Set<string>();
  const routerSymbols = new Map<string, RouterKind>();
  const routerDeclarations: RouterDeclaration[] = [];

  // Default heuristic: If variable is named 'app' or 'router', treat as potential candidate
  // But strictly register once initialized.

  traverse(ast, {
    // 1. Detect ESM imports: import express, { Router } from 'express'
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      if (path.node.source.value === "express") {
        for (const specifier of path.node.specifiers) {
          if (t.isImportDefaultSpecifier(specifier)) {
            expressImportNames.add(specifier.local.name);
          } else if (t.isImportSpecifier(specifier)) {
            const importedName = t.isIdentifier(specifier.imported)
              ? specifier.imported.name
              : specifier.imported.value;
            if (importedName === "Router") {
              routerImportNames.add(specifier.local.name);
            } else {
              expressImportNames.add(specifier.local.name);
            }
          } else if (t.isImportNamespaceSpecifier(specifier)) {
            expressImportNames.add(specifier.local.name);
          }
        }
      }
    },

    // 2. Detect CommonJS require: const express = require('express')
    VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
      const { id, init } = path.node;

      // Check require('express')
      if (
        init &&
        t.isCallExpression(init) &&
        t.isIdentifier(init.callee, { name: "require" }) &&
        init.arguments.length > 0 &&
        t.isStringLiteral(init.arguments[0], { value: "express" })
      ) {
        if (t.isIdentifier(id)) {
          expressImportNames.add(id.name);
        } else if (t.isObjectPattern(id)) {
          for (const prop of id.properties) {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key, { name: "Router" })) {
              if (t.isIdentifier(prop.value)) {
                routerImportNames.add(prop.value.name);
              }
            }
          }
        }
        return;
      }

      // Check app = express()
      if (
        init &&
        t.isCallExpression(init) &&
        t.isIdentifier(init.callee) &&
        (expressImportNames.has(init.callee.name) || init.callee.name === "express")
      ) {
        if (t.isIdentifier(id)) {
          routerSymbols.set(id.name, "APPLICATION");
          routerDeclarations.push({
            identifier: id.name,
            kind: "APPLICATION",
            loc: toSourceLocation(path.node.loc),
          });
        }
        return;
      }

      // Check router = express.Router() or Router() or new express.Router() (supports method chaining)
      const rootExpr = init && t.isExpression(init) ? unwrapChainedCall(init) : init;
      const isRouterCall =
        rootExpr &&
        (t.isCallExpression(rootExpr) || t.isNewExpression(rootExpr)) &&
        ((t.isMemberExpression(rootExpr.callee) &&
          t.isIdentifier(rootExpr.callee.property, { name: "Router" })) ||
          (t.isIdentifier(rootExpr.callee) &&
            (routerImportNames.has(rootExpr.callee.name) || rootExpr.callee.name === "Router")));

      if (isRouterCall && t.isIdentifier(id)) {
        routerSymbols.set(id.name, "ROUTER");
        routerDeclarations.push({
          identifier: id.name,
          kind: "ROUTER",
          loc: toSourceLocation(path.node.loc),
        });
        return;
      }

      // Check aliasing: const subRouter = router
      if (init && t.isIdentifier(init) && routerSymbols.has(init.name) && t.isIdentifier(id)) {
        const kind = routerSymbols.get(init.name)!;
        routerSymbols.set(id.name, kind);
        routerDeclarations.push({
          identifier: id.name,
          kind,
          loc: toSourceLocation(path.node.loc),
        });
      }
    },

    // 3. Detect default export router instantiations: export default Router().use(...)
    ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
      const decl = path.node.declaration;
      const rootExpr = decl && t.isExpression(decl) ? unwrapChainedCall(decl) : null;
      if (
        rootExpr &&
        (t.isCallExpression(rootExpr) || t.isNewExpression(rootExpr)) &&
        ((t.isMemberExpression(rootExpr.callee) &&
          t.isIdentifier(rootExpr.callee.property, { name: "Router" })) ||
          (t.isIdentifier(rootExpr.callee) &&
            (routerImportNames.has(rootExpr.callee.name) || rootExpr.callee.name === "Router")))
      ) {
        routerSymbols.set("default", "ROUTER");
        routerDeclarations.push({
          identifier: "default",
          kind: "ROUTER",
          loc: toSourceLocation(path.node.loc),
        });
      }
    },
  });

  return {
    expressImportNames,
    routerImportNames,
    routerSymbols,
    routerDeclarations,
  };
}
