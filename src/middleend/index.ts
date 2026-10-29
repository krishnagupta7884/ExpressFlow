/**
 * ExpressFlow Middle-End & Security Analysis Engine
 *
 * Responsibilities:
 * - Module & Symbol Resolution (cross-file linking of routers and imports/exports)
 * - URL Prefix Tree & Route Composition (calculates cumulative paths & middleware order)
 * - Control-Flow Graph (CFG) Construction (directed graphs of sequential middleware execution)
 * - Graph Dominator Tree Analysis (compiler-grade reachability proof)
 * - Security Invariant Verification (Auth-Before-Sensitive, Misordered Guards, Rate Limiting)
 * - Diagnostic Vulnerability Reporting
 */

export * from "./resolver/moduleResolver";
export * from "./composer/routeComposer";
export * from "./cfg/cfgModel";
export * from "./cfg/cfgBuilder";
export * from "./analysis/dominatorTree";
export * from "./analysis/securityModel";
export * from "./analysis/routePolicy";
export * from "./analysis/securityChecker";
export * from "./reporter/terminalReporter";

import { ExpressFlowManifest } from "../shared/types/manifest";
import { resolveModules, ProjectResolutionContext } from "./resolver/moduleResolver";
import { composeProjectRoutes, ComposedRoute } from "./composer/routeComposer";
import { buildProjectCfgs } from "./cfg/cfgBuilder";
import { RouteCfg } from "./cfg/cfgModel";
import { computeDominatorTree, DominatorTree } from "./analysis/dominatorTree";
import { checkSecurityInvariants } from "./analysis/securityChecker";
import { SecurityAnalysisReport } from "./analysis/securityModel";
import { ExpressFlowConfig, loadProjectConfig } from "./analysis/routePolicy";

export interface MiddleEndAnalysisResult {
  resolution: ProjectResolutionContext;
  composedRoutes: ComposedRoute[];
  cfgs: RouteCfg[];
  dominatorTrees: Map<string, DominatorTree>;
  securityReport: SecurityAnalysisReport;
}

/**
 * Runs the complete Middle-End and Security Invariant pipeline on a given IR Manifest.
 */
export function runMiddleEndPipeline(
  manifest: ExpressFlowManifest,
  config?: ExpressFlowConfig
): MiddleEndAnalysisResult {
  // Step 1: Resolve cross-file modules, imports, exports, and router mounts
  const resolution = resolveModules(manifest);

  // Step 2: Compose route hierarchy, cumulative URL paths, and ordered middlewares
  const composedRoutes = composeProjectRoutes(resolution);

  // Step 3: Construct Control-Flow Graphs (CFGs) for each reachable route
  const cfgs = buildProjectCfgs(composedRoutes);

  // Step 4: Compute formal Dominator Trees for each CFG
  const dominatorTrees = new Map<string, DominatorTree>();
  for (const cfg of cfgs) {
    dominatorTrees.set(cfg.routeId, computeDominatorTree(cfg));
  }

  // Load configuration if not explicitly provided
  let effectiveConfig = config;
  if (!effectiveConfig && manifest.projectRoot) {
    effectiveConfig = loadProjectConfig(manifest.projectRoot, manifest.diagnostics);
  }

  // Step 5: Verify security invariants using dominator reachability analysis
  const securityReport = checkSecurityInvariants(cfgs, effectiveConfig, manifest.diagnostics);

  return {
    resolution,
    composedRoutes,
    cfgs,
    dominatorTrees,
    securityReport,
  };
}
