import { File as BabelFile } from "@babel/types";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { ImportMetadata } from "../../shared/types/manifest";
import { toSourceLocation } from "./argumentExtractor";

/**
 * Scans an AST to track all module imports (both CommonJS require and ES Modules).
 * This feeds directly into the middle-end module resolver for cross-file router linking.
 */
export function trackImports(ast: BabelFile): ImportMetadata[] {
  const imports: ImportMetadata[] = [];

  traverse(ast, {
    // 1. ESM Imports: import userRouter from './routes/user'
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const source = path.node.source.value;

      for (const specifier of path.node.specifiers) {
        if (t.isImportDefaultSpecifier(specifier)) {
          imports.push({
            type: "DEFAULT",
            source,
            localIdentifier: specifier.local.name,
            importedName: "default",
            loc: toSourceLocation(specifier.loc),
          });
        } else if (t.isImportSpecifier(specifier)) {
          const importedName = t.isIdentifier(specifier.imported)
            ? specifier.imported.name
            : specifier.imported.value;
          imports.push({
            type: "NAMED",
            source,
            localIdentifier: specifier.local.name,
            importedName,
            loc: toSourceLocation(specifier.loc),
          });
        } else if (t.isImportNamespaceSpecifier(specifier)) {
          imports.push({
            type: "NAMESPACE",
            source,
            localIdentifier: specifier.local.name,
            loc: toSourceLocation(specifier.loc),
          });
        }
      }
    },

    // 2. CommonJS require: const userRouter = require('./routes/user')
    VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
      const { id, init } = path.node;

      if (
        init &&
        t.isCallExpression(init) &&
        t.isIdentifier(init.callee, { name: "require" }) &&
        init.arguments.length > 0 &&
        t.isStringLiteral(init.arguments[0])
      ) {
        const source = init.arguments[0].value;

        if (t.isIdentifier(id)) {
          imports.push({
            type: "REQUIRE",
            source,
            localIdentifier: id.name,
            importedName: "default",
            loc: toSourceLocation(path.node.loc),
          });
        } else if (t.isObjectPattern(id)) {
          for (const prop of id.properties) {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.value)) {
              const importedName = t.isIdentifier(prop.key)
                ? prop.key.name
                : t.isStringLiteral(prop.key)
                ? prop.key.value
                : undefined;

              imports.push({
                type: "NAMED",
                source,
                localIdentifier: prop.value.name,
                importedName,
                loc: toSourceLocation(prop.loc),
              });
            }
          }
        }
      }
    },
  });

  return imports;
}
