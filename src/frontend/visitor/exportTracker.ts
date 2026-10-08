import { File as BabelFile } from "@babel/types";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { ExportMetadata } from "../../shared/types/manifest";
import { toSourceLocation } from "./argumentExtractor";

/**
 * Scans an AST to find router exports (both CommonJS and ES Modules).
 */
export function trackExports(ast: BabelFile): ExportMetadata[] {
  const exports: ExportMetadata[] = [];

  traverse(ast, {
    // 1. ESM: export default router
    ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
      const decl = path.node.declaration;
      if (t.isIdentifier(decl)) {
        exports.push({
          type: "DEFAULT",
          localIdentifier: decl.name,
          loc: toSourceLocation(path.node.loc),
        });
      }
    },

    // 2. ESM: export const userRouter = router
    ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
      if (path.node.declaration && t.isVariableDeclaration(path.node.declaration)) {
        for (const declarator of path.node.declaration.declarations) {
          if (t.isIdentifier(declarator.id)) {
            exports.push({
              type: "NAMED",
              exportName: declarator.id.name,
              localIdentifier: declarator.id.name,
              loc: toSourceLocation(path.node.loc),
            });
          }
        }
      }
    },

    // 3. CommonJS: module.exports = router
    AssignmentExpression(path: NodePath<t.AssignmentExpression>) {
      const { left, right } = path.node;

      // module.exports = router
      if (
        t.isMemberExpression(left) &&
        t.isIdentifier(left.object, { name: "module" }) &&
        t.isIdentifier(left.property, { name: "exports" }) &&
        t.isIdentifier(right)
      ) {
        exports.push({
          type: "DEFAULT",
          localIdentifier: right.name,
          loc: toSourceLocation(path.node.loc),
        });
        return;
      }

      // exports.userRouter = router
      if (
        t.isMemberExpression(left) &&
        t.isIdentifier(left.object, { name: "exports" }) &&
        t.isIdentifier(left.property) &&
        t.isIdentifier(right)
      ) {
        exports.push({
          type: "NAMED",
          exportName: left.property.name,
          localIdentifier: right.name,
          loc: toSourceLocation(path.node.loc),
        });
      }
    },
  });

  return exports;
}
