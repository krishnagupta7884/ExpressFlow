import { File as BabelFile } from "@babel/types";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import {
  HttpMethod,
  MountRegistration,
  RouteRegistration,
} from "../../shared/types/manifest";
import { SymbolTable } from "../scope/symbolTracker";
import {
  extractMiddlewareMetadata,
  extractRoutePath,
  flattenMiddlewareNodes,
  isPathNode,
  toSourceLocation,
} from "./argumentExtractor";

const HTTP_VERBS = new Set<string>([
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "options",
  "head",
  "all",
]);

export interface RouteExtractionResult {
  routeRegistrations: RouteRegistration[];
  mounts: MountRegistration[];
}

/**
 * Traverses an AST to extract all Express route registrations, middlewares, and sub-router mounts.
 */
export function extractRoutesAndMounts(
  ast: BabelFile,
  symbolTable: SymbolTable
): RouteExtractionResult {
  const routeRegistrations: RouteRegistration[] = [];
  const mounts: MountRegistration[] = [];

  traverse(ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      const { callee, arguments: args } = path.node;

      // Must be a member expression: object.method(...)
      if (!t.isMemberExpression(callee) || !t.isIdentifier(callee.property)) {
        return;
      }

      const methodName = callee.property.name.toLowerCase();

      // Determine the router identifier
      let routerIdentifier = "";
      if (t.isIdentifier(callee.object)) {
        routerIdentifier = callee.object.name;
      } else if (t.isCallExpression(callee.object)) {
        // Chained call: e.g. Router().use(...).use(...) or const api = Router().use(...)
        const varDecl = path.findParent((p) => p.isVariableDeclarator()) as NodePath<t.VariableDeclarator> | null;
        if (varDecl && t.isIdentifier(varDecl.node.id)) {
          routerIdentifier = varDecl.node.id.name;
        } else {
          const exportDef = path.findParent((p) => p.isExportDefaultDeclaration());
          if (exportDef) {
            routerIdentifier = "default";
          }
        }
      }

      // Check if this object is a recognized Express router or application
      // (Also accept 'app' or 'router' by standard convention as fallback)
      const isTrackedRouter =
        symbolTable.routerSymbols.has(routerIdentifier) ||
        routerIdentifier === "app" ||
        routerIdentifier === "router" ||
        routerIdentifier === "default";

      if (!isTrackedRouter) {
        return;
      }

      // 1. Handling app.use(...) / router.use(...)
      if (methodName === "use") {
        if (args.length === 0) return;

        let pathNode: t.Node | undefined;
        let middlewareArgs: t.Node[] = [];

        if (isPathNode(args[0])) {
          pathNode = args[0];
          middlewareArgs = args.slice(1);
        } else {
          // Global middleware without explicit path: app.use(cors())
          middlewareArgs = args;
        }

        const routePath = extractRoutePath(pathNode);

        // Check if mounting a sub-router: app.use('/admin', adminRouter)
        const flattened = flattenMiddlewareNodes(middlewareArgs);
        for (const mwNode of flattened) {
          if (
            t.isIdentifier(mwNode) &&
            (symbolTable.routerSymbols.get(mwNode.name) === "ROUTER" ||
              mwNode.name.toLowerCase().includes("router") ||
              mwNode.name.toLowerCase().includes("routes") ||
              mwNode.name.toLowerCase().includes("controller"))
          ) {
            mounts.push({
              registrationType: "MOUNT",
              parentRouter: routerIdentifier,
              subRouterIdentifier: mwNode.name,
              path: routePath,
              loc: toSourceLocation(path.node.loc),
            });
            return;
          }
        }

        // Otherwise, this is a middleware registration: app.use('/api', authMiddleware)
        const middlewares = flattened.map((node, index) =>
          extractMiddlewareMetadata(node, index)
        );

        routeRegistrations.push({
          registrationType: "ROUTE",
          routerIdentifier,
          httpMethod: "ALL", // app.use applies to all HTTP verbs
          path: routePath,
          middlewares,
          loc: toSourceLocation(path.node.loc),
        });
        return;
      }

      // 2. Handling HTTP Verbs: app.get, app.post, router.delete, etc.
      if (HTTP_VERBS.has(methodName)) {
        if (args.length === 0) return;

        let pathNode: t.Node | undefined;
        let middlewareArgs: t.Node[] = [];

        if (isPathNode(args[0])) {
          pathNode = args[0];
          middlewareArgs = args.slice(1);
        } else {
          middlewareArgs = args;
        }

        const routePath = extractRoutePath(pathNode);
        const flattened = flattenMiddlewareNodes(middlewareArgs);
        const middlewares = flattened.map((node, index) =>
          extractMiddlewareMetadata(node, index)
        );

        routeRegistrations.push({
          registrationType: "ROUTE",
          routerIdentifier,
          httpMethod: methodName.toUpperCase() as HttpMethod,
          path: routePath,
          middlewares,
          loc: toSourceLocation(path.node.loc),
        });
        return;
      }
    },
  });

  return {
    routeRegistrations,
    mounts,
  };
}
