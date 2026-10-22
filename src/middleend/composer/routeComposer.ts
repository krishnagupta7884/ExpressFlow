import {
  HttpMethod,
  MiddlewareMetadata,
  MiddlewareType,
  RouteRegistration,
  SourceLocation,
} from "../../shared/types/manifest";
import { ProjectResolutionContext, ResolvedMount, ResolvedRouter } from "../resolver/moduleResolver";

export type MiddlewareScope = "GLOBAL" | "MOUNT" | "ROUTER" | "ROUTE";

export interface ComposedMiddleware {
  scope: MiddlewareScope;
  executionOrder: number;
  type: MiddlewareType;
  name: string | null;
  rawExpression: string;
  isInline: boolean;
  params?: string[];
  sourceFile: string;
  loc: SourceLocation;
}

export interface ComposedRoute {
  id: string;                         // e.g. "DELETE /api/users/:id"
  httpMethod: HttpMethod;
  fullPath: string;                   // Normalized full path, e.g. "/api/users/:id"
  routerHierarchy: string[];          // List of router identifiers traversed
  effectiveMiddlewares: ComposedMiddleware[]; // Monotonically ordered middlewares
  terminalHandler: ComposedMiddleware | null;
  sourceFile: string;
  loc: SourceLocation;
}

/**
 * Combines two URL path segments, eliminating duplicate slashes and ensuring a leading slash.
 */
export function combinePaths(parent: string, child: string): string {
  const p = (parent || "").trim();
  const c = (child || "").trim();

  let combined = "";

  if (!p || p === "/") {
    combined = c.startsWith("/") ? c : "/" + c;
  } else if (!c || c === "/") {
    combined = p.startsWith("/") ? p : "/" + p;
  } else {
    const cleanParent = p.endsWith("/") ? p.slice(0, -1) : p;
    const cleanChild = c.startsWith("/") ? c : "/" + c;
    combined = cleanParent + cleanChild;
  }

  // Ensure leading slash and remove trailing slash (unless root "/")
  combined = combined.replace(/\/+/g, "/");
  if (!combined.startsWith("/")) {
    combined = "/" + combined;
  }
  if (combined.length > 1 && combined.endsWith("/")) {
    combined = combined.slice(0, -1);
  }

  return combined || "/";
}

/**
 * Recursively traverses a router hierarchy to assemble all reachable routes,
 * compose cumulative URL paths, and collect inherited middleware chains.
 */
function traverseRouter(
  router: ResolvedRouter,
  currentPath: string,
  inheritedMiddlewares: ComposedMiddleware[],
  visitedRouterIds: Set<string>,
  resolution: ProjectResolutionContext,
  hierarchy: string[],
  results: ComposedRoute[]
) {
  if (visitedRouterIds.has(router.id)) {
    // Avoid circular mount loops
    return;
  }
  visitedRouterIds.add(router.id);

  const currentHierarchy = [...hierarchy, `${router.identifier} (${router.filePath})`];

  // 1. Separate router-level / global middlewares from actual HTTP route endpoints
  const routerLevelMiddlewares: ComposedMiddleware[] = [];
  const endpointRoutes: RouteRegistration[] = [];

  for (const reg of router.routeRegistrations) {
    if (reg.httpMethod === "ALL" && (reg.path.value === "/" || reg.path.value === "")) {
      // Global/Router-level middleware: router.use(cors())
      for (const mw of reg.middlewares) {
        routerLevelMiddlewares.push({
          scope: router.kind === "APPLICATION" ? "GLOBAL" : "ROUTER",
          executionOrder: 0, // Assigned later
          type: mw.type,
          name: mw.name,
          rawExpression: mw.rawExpression,
          isInline: mw.isInline,
          params: mw.params,
          sourceFile: router.filePath,
          loc: mw.loc,
        });
      }
    } else {
      endpointRoutes.push(reg);
    }
  }

  const cumulativeMiddlewares = [...inheritedMiddlewares, ...routerLevelMiddlewares];

  // 2. Process all direct endpoint routes registered on this router
  for (const reg of endpointRoutes) {
    const fullPath = combinePaths(currentPath, reg.path.value);

    // Convert route middlewares
    const routeMiddlewares: ComposedMiddleware[] = reg.middlewares.map((mw) => ({
      scope: "ROUTE",
      executionOrder: 0,
      type: mw.type,
      name: mw.name,
      rawExpression: mw.rawExpression,
      isInline: mw.isInline,
      params: mw.params,
      sourceFile: router.filePath,
      loc: mw.loc,
    }));

    const allMiddlewares = [...cumulativeMiddlewares, ...routeMiddlewares];

    // Assign monotonic executionOrder
    allMiddlewares.forEach((mw, idx) => {
      mw.executionOrder = idx;
    });

    const terminalHandler =
      allMiddlewares.length > 0 ? allMiddlewares[allMiddlewares.length - 1] : null;

    results.push({
      id: `${reg.httpMethod} ${fullPath}`,
      httpMethod: reg.httpMethod,
      fullPath,
      routerHierarchy: currentHierarchy,
      effectiveMiddlewares: allMiddlewares,
      terminalHandler,
      sourceFile: router.filePath,
      loc: reg.loc,
    });
  }

  // 3. Process sub-router mounts
  for (const mount of router.mounts) {
    if (!mount.targetRouterId) {
      continue;
    }

    const subRouter = resolution.routers.get(mount.targetRouterId);
    if (!subRouter) {
      continue;
    }

    const subPath = combinePaths(currentPath, mount.mountPath);

    traverseRouter(
      subRouter,
      subPath,
      cumulativeMiddlewares,
      new Set(visitedRouterIds),
      resolution,
      currentHierarchy,
      results
    );
  }
}

/**
 * Composes all routes across the project by traversing from root applications
 * through prefix-mounted sub-routers.
 */
export function composeProjectRoutes(
  resolution: ProjectResolutionContext
): ComposedRoute[] {
  const routes: ComposedRoute[] = [];
  const visitedGlobalRouters = new Set<string>();

  // Traverse each root application
  for (const app of resolution.rootApplications) {
    traverseRouter(
      app,
      "/",
      [],
      visitedGlobalRouters,
      resolution,
      [],
      routes
    );
  }

  // Also traverse any standalone routers that were not mounted to any app
  for (const router of resolution.standaloneRouters) {
    if (!visitedGlobalRouters.has(router.id)) {
      traverseRouter(
        router,
        "/",
        [],
        visitedGlobalRouters,
        resolution,
        [],
        routes
      );
    }
  }

  return routes;
}
