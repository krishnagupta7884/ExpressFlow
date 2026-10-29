import { AnalysisDiagnostics, AnalysisStatus } from "../../shared/types/manifest";
import { CfgNode, RouteCfg } from "../cfg/cfgModel";
import { computeDominatorTree } from "./dominatorTree";
import {
  ExpressFlowConfig,
  isAuthEntrypoint,
  isPublicRoute,
  requiresAuthentication,
  requiresRateLimiting,
  requiresRoleAuthorization,
} from "./routePolicy";
import {
  InvariantRuleId,
  SecurityAnalysisReport,
  SecurityViolation,
  VulnerabilitySeverity,
} from "./securityModel";

// Regular expressions to identify security checkpoint patterns
const AUTH_PATTERNS = /(auth|token|jwt|session|permit|guard|protect|passport|verify|check|require|ensure|authenticated)/i;
const RATE_LIMIT_PATTERNS = /(rateLimit|limiter|throttle|brute|ddos)/i;
const ROLE_PATTERNS = /(admin|role|permission|scope|privilege|checkAdmin|requireAdmin|authorize)/i;
const HANDLER_SUFFIX_PATTERNS = /(handler|controller|action)$/i;
const UTILITY_MIDDLEWARE_PATTERNS = /(logger|logging|log|cors|bodyparser|parser|cookie|compress|helmet|upload|multer|validate|validator|sanitiz)/i;

/**
 * Checks whether a node represents an authentication guard.
 * Excludes terminal handlers like `loginHandler` or `userController`.
 */
export function isAuthenticationNode(node: CfgNode): boolean {
  if (node.type === "ENTRY" || node.type === "EXIT") {
    return false;
  }
  const name = node.middleware?.name || node.label || "";
  const raw = node.middleware?.rawExpression || "";

  // If explicitly named with a handler suffix, it represents business logic, not a security guard
  if (HANDLER_SUFFIX_PATTERNS.test(name) && !name.toLowerCase().includes("guard") && !name.toLowerCase().includes("auth")) {
    return false;
  }

  return AUTH_PATTERNS.test(name) || AUTH_PATTERNS.test(raw);
}

/**
 * Checks whether a node represents a rate-limiting middleware.
 */
export function isRateLimitNode(node: CfgNode): boolean {
  if (node.type === "ENTRY" || node.type === "EXIT") {
    return false;
  }
  const name = node.middleware?.name || node.label || "";
  const raw = node.middleware?.rawExpression || "";
  return RATE_LIMIT_PATTERNS.test(name) || RATE_LIMIT_PATTERNS.test(raw);
}

/**
 * Checks whether a node represents an admin role or authorization guard.
 */
export function isRoleGuardNode(node: CfgNode): boolean {
  if (node.type === "ENTRY" || node.type === "EXIT") {
    return false;
  }
  const name = node.middleware?.name || node.label || "";
  const raw = node.middleware?.rawExpression || "";

  if (HANDLER_SUFFIX_PATTERNS.test(name)) {
    return false;
  }

  return ROLE_PATTERNS.test(name) || ROLE_PATTERNS.test(raw);
}

/**
 * Determines whether a CFG node is an action handler (terminal controller or business logic function),
 * as opposed to an intermediate utility middleware or security guard.
 */
export function isActionHandlerNode(node: CfgNode): boolean {
  if (node.type === "ENTRY" || node.type === "EXIT") {
    return false;
  }
  // Global and mount-level middlewares are never route-specific action handlers
  if (node.middleware?.scope === "GLOBAL" || node.middleware?.scope === "MOUNT") {
    return false;
  }

  // Security checkpoints are never action handlers
  if (isAuthenticationNode(node) || isRoleGuardNode(node) || isRateLimitNode(node)) {
    return false;
  }

  const name = node.middleware?.name || node.label || "";

  // Known utility middleware names are not action handlers
  if (UTILITY_MIDDLEWARE_PATTERNS.test(name)) {
    return false;
  }

  // Explicit handler suffix (dropDatabaseHandler, userController, etc.)
  if (HANDLER_SUFFIX_PATTERNS.test(name)) {
    return true;
  }

  // Inline functions (req, res, next) => { ... } are conventionally handlers
  if (node.middleware?.isInline) {
    return true;
  }

  // If node was marked as terminal handler in CFG construction and is not a guard
  if (node.type === "CONTROLLER_HANDLER" || node.id === "HANDLER") {
    return true;
  }

  return false;
}

/**
 * Evaluates whether an HTTP route is classified as sensitive based on route policy.
 * Maintained for backward compatibility.
 */
export function isSensitiveEndpoint(cfg: RouteCfg, config?: ExpressFlowConfig): boolean {
  return requiresAuthentication(cfg, config);
}

/**
 * Generates a clean human-readable execution trace from the CFG.
 */
function buildTrace(cfg: RouteCfg): string[] {
  return cfg.nodes.map((n) => {
    const locStr = n.loc && n.loc.start.line > 0 ? ` (${n.sourceFile}:${n.loc.start.line})` : "";
    return `${n.label}${locStr}`;
  });
}

/**
 * Runs formal security invariant analysis across all Control-Flow Graphs in a project.
 */
export function checkSecurityInvariants(
  cfgs: RouteCfg[],
  config?: ExpressFlowConfig,
  manifestDiagnostics?: AnalysisDiagnostics
): SecurityAnalysisReport {
  const violations: SecurityViolation[] = [];
  const vulnerableRouteIds = new Set<string>();

  for (const cfg of cfgs) {
    const domTree = computeDominatorTree(cfg);
    const trace = buildTrace(cfg);

    const isSensitive = requiresAuthentication(cfg, config);
    const isAdminPath = requiresRoleAuthorization(cfg, config);
    const isAuthEntry = requiresRateLimiting(cfg, config);

    // Identify all nodes matching security roles
    const authNodes = cfg.nodes.filter(isAuthenticationNode);
    const rateLimitNodes = cfg.nodes.filter(isRateLimitNode);
    const roleNodes = cfg.nodes.filter(isRoleGuardNode);
    const actionHandlers = cfg.nodes.filter(isActionHandlerNode);

    const securityGuards = cfg.nodes.filter((n) => isAuthenticationNode(n) || isRoleGuardNode(n));

    // -------------------------------------------------------------------------
    // Rule 2 Check: Misordered Security Middleware Execution
    // Occurs when an auth or role guard was placed AFTER an action handler
    // -------------------------------------------------------------------------
    let hasMisorderedGuard = false;

    for (const guard of securityGuards) {
      // Find any action handler that executed BEFORE this security guard
      const prematureHandler = actionHandlers.find((h) => h.executionIndex < guard.executionIndex);
      if (prematureHandler) {
        hasMisorderedGuard = true;

        violations.push({
          id: `VIOLATION_${cfg.routeId}_MISORDERED_${guard.id}`,
          ruleId: "RULE_2_MISORDERED_SECURITY_GUARD",
          ruleName: "Misordered Security Middleware Execution",
          severity: "CRITICAL",
          routeId: cfg.routeId,
          method: cfg.method,
          fullPath: cfg.fullPath,
          sourceFile: cfg.sourceFile,
          loc: guard.loc || cfg.loc,
          violatingNodeLabel: guard.label,
          message: `Security guard '${guard.label}' is registered AFTER the action handler '${prematureHandler.label}'. The sensitive handler will execute before authentication is enforced!`,
          formalInvariant: "A ∈ AuthCheckpoints ⟹ A dom H ∧ executionOrder(A) < executionOrder(H)",
          remediation: `Move security middleware '${guard.label}' to precede '${prematureHandler.label}' in the route definition argument list.`,
          executionTrace: trace,
        });

        vulnerableRouteIds.add(cfg.routeId);
        break; // Flag once per route
      }
    }

    // -------------------------------------------------------------------------
    // Rule 1: Auth-Before-Sensitive-Operation (Missing Auth Guard entirely)
    // -------------------------------------------------------------------------
    if (isSensitive) {
      const primaryHandler =
        actionHandlers[actionHandlers.length - 1] ||
        cfg.nodes.find((n) => n.id === cfg.terminalHandlerNodeId) ||
        cfg.nodes[cfg.nodes.length - 2];

      const validAuthGuards = authNodes.filter((g) => {
        if (!primaryHandler) return false;
        return g.executionIndex < primaryHandler.executionIndex && domTree.dominates(g.id, primaryHandler.id);
      });

      if (validAuthGuards.length === 0 && !hasMisorderedGuard) {
        const severity: VulnerabilitySeverity =
          cfg.method === "DELETE" || isAdminPath ? "CRITICAL" : "HIGH";

        violations.push({
          id: `VIOLATION_${cfg.method}_${cfg.fullPath.replace(/[^a-zA-Z0-9]/g, "_")}_NO_AUTH`,
          ruleId: "RULE_1_AUTH_BEFORE_SENSITIVE",
          ruleName: "Unauthenticated Sensitive Route Detected",
          severity,
          routeId: cfg.routeId,
          method: cfg.method,
          fullPath: cfg.fullPath,
          sourceFile: cfg.sourceFile,
          loc: primaryHandler?.loc || cfg.loc,
          violatingNodeLabel: primaryHandler?.label || "Handler",
          message: `Endpoint '${cfg.method} ${cfg.fullPath}' executes sensitive action '${primaryHandler?.label}' without any authentication or authorization guards.`,
          formalInvariant: "∀ H ∈ SensitiveHandlers, ∃ A ∈ AuthCheckpoints such that A dom H",
          remediation: `Insert an authentication guard middleware (e.g. 'verifyToken' or 'verifyAdmin') before '${primaryHandler?.label}' in ${cfg.sourceFile}.`,
          executionTrace: trace,
        });

        vulnerableRouteIds.add(cfg.routeId);
      }
    }

    // -------------------------------------------------------------------------
    // Rule 3: Unprotected Administrative Route (Missing Role/Privilege Guard)
    // -------------------------------------------------------------------------
    if (isAdminPath && roleNodes.length === 0 && authNodes.length > 0 && !hasMisorderedGuard) {
      const primaryHandler =
        actionHandlers[actionHandlers.length - 1] ||
        cfg.nodes.find((n) => n.id === cfg.terminalHandlerNodeId) ||
        cfg.nodes[cfg.nodes.length - 2];

      violations.push({
        id: `VIOLATION_${cfg.routeId}_UNPROTECTED_ADMIN_ROLE`,
        ruleId: "RULE_3_UNPROTECTED_ADMIN_MOUNT",
        ruleName: "Administrative Route Lacks Role-Based Authorization",
        severity: "HIGH",
        routeId: cfg.routeId,
        method: cfg.method,
        fullPath: cfg.fullPath,
        sourceFile: cfg.sourceFile,
        loc: primaryHandler?.loc || cfg.loc,
        violatingNodeLabel: primaryHandler?.label || "Handler",
        message: `Administrative route '${cfg.method} ${cfg.fullPath}' has general authentication but lacks an explicit role/privilege authorization check (e.g. 'checkAdmin').`,
        formalInvariant: "∀ R ∈ AdminRoutes, ∃ G ∈ RoleCheckpoints such that G dom Handler(R)",
        remediation: `Attach an administrative authorization guard (e.g. 'requireAdmin' or 'checkRole(\"admin\")') to verify elevated privileges.`,
        executionTrace: trace,
      });

      vulnerableRouteIds.add(cfg.routeId);
    }

    // -------------------------------------------------------------------------
    // Rule 4: Missing Rate Limiting on Authentication Entrypoints
    // -------------------------------------------------------------------------
    if (isAuthEntry && rateLimitNodes.length === 0) {
      const primaryHandler =
        actionHandlers[actionHandlers.length - 1] ||
        cfg.nodes.find((n) => n.id === cfg.terminalHandlerNodeId) ||
        cfg.nodes[cfg.nodes.length - 2];

      violations.push({
        id: `VIOLATION_${cfg.routeId}_MISSING_RATE_LIMIT`,
        ruleId: "RULE_4_MISSING_RATE_LIMIT",
        ruleName: "Missing Rate-Limiting on Authentication Endpoint",
        severity: "MEDIUM",
        routeId: cfg.routeId,
        method: cfg.method,
        fullPath: cfg.fullPath,
        sourceFile: cfg.sourceFile,
        loc: primaryHandler?.loc || cfg.loc,
        violatingNodeLabel: primaryHandler?.label || "Handler",
        message: `Authentication endpoint '${cfg.method} ${cfg.fullPath}' lacks brute-force throttling middleware, exposing it to automated credential stuffing attacks.`,
        formalInvariant: "∀ R ∈ AuthEntrypoints, ∃ L ∈ RateLimiters such that L dom Handler(R)",
        remediation: `Apply a rate-limiting middleware (e.g. 'express-rate-limit' or 'rateLimit({ max: 5 })') to throttle repeated requests.`,
        executionTrace: trace,
      });

      vulnerableRouteIds.add(cfg.routeId);
    }
  }

  const criticalCount = violations.filter((v) => v.severity === "CRITICAL").length;
  const highCount = violations.filter((v) => v.severity === "HIGH").length;
  const mediumCount = violations.filter((v) => v.severity === "MEDIUM").length;
  const lowCount = violations.filter((v) => v.severity === "LOW").length;

  let status: AnalysisStatus = "COMPLETE";
  let statusMessage = "All security invariants analyzed successfully.";

  if (manifestDiagnostics && manifestDiagnostics.status === "INCOMPLETE") {
    status = "INCOMPLETE";
    statusMessage =
      manifestDiagnostics.statusMessage ||
      `${manifestDiagnostics.failedFiles} file(s) failed during parsing. Analysis is incomplete.`;
  } else if (cfgs.length === 0) {
    status = "INCONCLUSIVE";
    statusMessage =
      manifestDiagnostics?.statusMessage ||
      "Analysis completed, but 0 route Control-Flow Graphs were synthesized. Route security was not evaluated.";
  } else if (violations.length > 0) {
    status = "COMPLETE";
    statusMessage = `${violations.length} security violation(s) detected across ${cfgs.length} route CFGs.`;
  }

  const passed = status === "COMPLETE" && violations.length === 0;

  return {
    status,
    statusMessage,
    diagnostics: manifestDiagnostics,
    analyzedAt: new Date().toISOString(),
    totalRoutes: cfgs.length,
    cleanRoutes: cfgs.length - vulnerableRouteIds.size,
    vulnerableRoutes: vulnerableRouteIds.size,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    violations,
    passed,
  };
}
