/**
 * ExpressFlow Middle-End Engine
 * Lead: Aaditya Jaiswal
 *
 * Responsibilities:
 * - Module & Symbol Resolution (cross-file linking of routers and imports/exports)
 * - URL Prefix Tree & Route Composition (calculates cumulative paths & middleware order)
 * - Control-Flow Graph (CFG) Construction (directed graphs of sequential middleware execution)
 */

export * from "./resolver/moduleResolver";
export * from "./composer/routeComposer";
export * from "./cfg/cfgModel";
export * from "./cfg/cfgBuilder";

import { ExpressFlowManifest } from "../shared/types/manifest";
import { resolveModules, ProjectResolutionContext } from "./resolver/moduleResolver";
import { composeProjectRoutes, ComposedRoute } from "./composer/routeComposer";
import { buildProjectCfgs } from "./cfg/cfgBuilder";
import { RouteCfg } from "./cfg/cfgModel";

export interface MiddleEndAnalysisResult {
  resolution: ProjectResolutionContext;
  composedRoutes: ComposedRoute[];
  cfgs: RouteCfg[];
}

/**
 * Runs the complete Middle-End pipeline on a given Intermediate Representation (IR) Manifest.
 */
export function runMiddleEndPipeline(
  manifest: ExpressFlowManifest
): MiddleEndAnalysisResult {
  // Step 1: Resolve cross-file modules, imports, exports, and router mounts
  const resolution = resolveModules(manifest);

  // Step 2: Compose route hierarchy, cumulative URL paths, and ordered middlewares
  const composedRoutes = composeProjectRoutes(resolution);

  // Step 3: Construct Control-Flow Graphs (CFGs) for each reachable route
  const cfgs = buildProjectCfgs(composedRoutes);

  return {
    resolution,
    composedRoutes,
    cfgs,
  };
}
