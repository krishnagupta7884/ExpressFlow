import { CfgNode, RouteCfg } from "../cfg/cfgModel";
import { computeDominatorTree } from "./dominatorTree";
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

// Regular expressions to identify sensitive actions
const SENSITIVE_PATH_PATTERNS = /(\/admin|\/database|\/purge|\/restart|\/user|\/account|\/payment|\/checkout|\/settings|\/config|\/secret|\/drop|\/execute)/i;
const AUTH_ENTRYPOINT_PATTERNS = /(\/login|\/signin|\/auth|\/register|\/signup|\/reset-password|\/checkout)/i;

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
 * Evaluates whether an HTTP route is classified as sensitive based on HTTP verb and URL path.
 */
export function isSensitiveEndpoint(cfg: RouteCfg): boolean {
  // Public healthcheck exemption
  if (cfg.fullPath === "/health" || cfg.fullPath === "/status" || cfg.fullPath === "/ping") {
    return false;
  }

  // Any state-mutating verb is inherently sensitive
  if (["DELETE", "PUT", "PATCH"].includes(cfg.method)) {
    return true;
  }

  // POST endpoints with sensitive paths
  if (cfg.method === "POST" && SENSITIVE_PATH_PATTERNS.test(cfg.fullPath)) {
    return true;
  }

  // Paths explicitly touching admin or privileged resources
  if (SENSITIVE_PATH_PATTERNS.test(cfg.fullPath)) {
    return true;
  }

  return false;
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
export function checkSecurityInvariants(cfgs: RouteCfg[]): SecurityAnalysisReport {
  const violations: SecurityViolation[] = [];
  const vulnerableRouteIds = new Set<string>();

  for (const cfg of cfgs) {
    const domTree = computeDominatorTree(cfg);
    const trace = buildTrace(cfg);

    const isSensitive = isSensitiveEndpoint(cfg);
    const isAdminPath = cfg.fullPath.includes("/admin");
    const isAuthEntrypoint = cfg.method === "POST" && AUTH_ENTRYPOINT_PATTERNS.test(cfg.fullPath);

    // Identify all nodes matching security roles
    const authNodes = cfg.nodes.filter(isAuthenticationNode);
    const rateLimitNodes = cfg.nodes.filter(isRateLimitNode);
    const roleNodes = cfg.nodes.filter(isRoleGuardNode);

    // Terminal node before EXIT
    const lastNode = cfg.nodes[cfg.nodes.length - 2];
    const terminalIsAuth = lastNode ? isAuthenticationNode(lastNode) : false;

    // -------------------------------------------------------------------------
    // Rule 2 Check: Misordered Security Middleware Execution
    // Occurs when an auth guard was placed AFTER a sensitive action handler
    // -------------------------------------------------------------------------
    let hasMisorderedGuard = false;

    if (terminalIsAuth && cfg.nodes.length > 3) {
      // e.g. [ENTRY, express.json, dropDatabaseHandler, verifyAdmin, EXIT]
      // Here verifyAdmin is placed last, while dropDatabaseHandler executed before it!
      const actionNode = cfg.nodes[2];
      hasMisorderedGuard = true;

      violations.push({
        id: `VIOLATION_${cfg.routeId}_MISORDERED_${lastNode.id}`,
        ruleId: "RULE_2_MISORDERED_SECURITY_GUARD",
        ruleName: "Misordered Security Middleware Execution",
        severity: "CRITICAL",
        routeId: cfg.routeId,
        method: cfg.method,
        fullPath: cfg.fullPath,
        sourceFile: cfg.sourceFile,
        loc: lastNode.loc || cfg.loc,
        violatingNodeLabel: lastNode.label,
        message: `Security guard '${lastNode.label}' is registered AFTER the action handler '${actionNode.label}'. The sensitive handler will execute before authentication is enforced!`,
        formalInvariant: "A ∈ AuthCheckpoints ⟹ A dom H ∧ executionOrder(A) < executionOrder(H)",
        remediation: `Move security middleware '${lastNode.label}' to precede '${actionNode.label}' in the route definition argument list.`,
        executionTrace: trace,
      });

      vulnerableRouteIds.add(cfg.routeId);
    } else {
      // Check if any auth node is placed after another handler
      for (const authNode of authNodes) {
        const handlerNode = cfg.nodes.find((n) => n.id === cfg.terminalHandlerNodeId);
        if (handlerNode && !terminalIsAuth && authNode.id !== handlerNode.id) {
          const authDominatesHandler = domTree.strictlyDominates(authNode.id, handlerNode.id);
          const isExecutingAfter = authNode.executionIndex > handlerNode.executionIndex;

          if (!authDominatesHandler || isExecutingAfter) {
            hasMisorderedGuard = true;
            violations.push({
              id: `VIOLATION_${cfg.routeId}_MISORDERED_${authNode.id}`,
              ruleId: "RULE_2_MISORDERED_SECURITY_GUARD",
              ruleName: "Misordered Security Middleware Execution",
              severity: "CRITICAL",
              routeId: cfg.routeId,
              method: cfg.method,
              fullPath: cfg.fullPath,
              sourceFile: cfg.sourceFile,
              loc: authNode.loc || cfg.loc,
              violatingNodeLabel: authNode.label,
              message: `Security guard '${authNode.label}' does not dominate handler '${handlerNode.label}'. Execution proceeds to handler without strict guard enforcement!`,
              formalInvariant: "A ∈ AuthCheckpoints ⟹ A dom H",
              remediation: `Move security middleware '${authNode.label}' to precede '${handlerNode.label}' in the route definition argument list.`,
              executionTrace: trace,
            });

            vulnerableRouteIds.add(cfg.routeId);
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // Rule 1: Auth-Before-Sensitive-Operation (Missing Auth Guard entirely)
    // -------------------------------------------------------------------------
    if (isSensitive && authNodes.length === 0) {
      const handlerNode = cfg.nodes.find((n) => n.id === cfg.terminalHandlerNodeId) || cfg.nodes[cfg.nodes.length - 2];
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
        loc: handlerNode?.loc || cfg.loc,
        violatingNodeLabel: handlerNode?.label || "Handler",
        message: `Endpoint '${cfg.method} ${cfg.fullPath}' executes sensitive action '${handlerNode?.label}' without any authentication or authorization guards.`,
        formalInvariant: "∀ H ∈ SensitiveHandlers, ∃ A ∈ AuthCheckpoints such that A dom H",
        remediation: `Insert an authentication guard middleware (e.g. 'verifyToken' or 'verifyAdmin') before '${handlerNode?.label}' in ${cfg.sourceFile}.`,
        executionTrace: trace,
      });

      vulnerableRouteIds.add(cfg.routeId);
    }

    // -------------------------------------------------------------------------
    // Rule 3: Unprotected Administrative Route (Missing Role/Privilege Guard)
    // -------------------------------------------------------------------------
    if (isAdminPath && roleNodes.length === 0 && authNodes.length > 0 && !hasMisorderedGuard) {
      const handlerNode = cfg.nodes.find((n) => n.id === cfg.terminalHandlerNodeId) || cfg.nodes[cfg.nodes.length - 2];
      violations.push({
        id: `VIOLATION_${cfg.routeId}_UNPROTECTED_ADMIN_ROLE`,
        ruleId: "RULE_3_UNPROTECTED_ADMIN_MOUNT",
        ruleName: "Administrative Route Lacks Role-Based Authorization",
        severity: "HIGH",
        routeId: cfg.routeId,
        method: cfg.method,
        fullPath: cfg.fullPath,
        sourceFile: cfg.sourceFile,
        loc: handlerNode?.loc || cfg.loc,
        violatingNodeLabel: handlerNode?.label || "Handler",
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
    if (isAuthEntrypoint && rateLimitNodes.length === 0) {
      const handlerNode = cfg.nodes.find((n) => n.id === cfg.terminalHandlerNodeId) || cfg.nodes[cfg.nodes.length - 2];
      violations.push({
        id: `VIOLATION_${cfg.routeId}_MISSING_RATE_LIMIT`,
        ruleId: "RULE_4_MISSING_RATE_LIMIT",
        ruleName: "Missing Rate-Limiting on Authentication Endpoint",
        severity: "MEDIUM",
        routeId: cfg.routeId,
        method: cfg.method,
        fullPath: cfg.fullPath,
        sourceFile: cfg.sourceFile,
        loc: handlerNode?.loc || cfg.loc,
        violatingNodeLabel: handlerNode?.label || "Handler",
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

  return {
    analyzedAt: new Date().toISOString(),
    totalRoutes: cfgs.length,
    cleanRoutes: cfgs.length - vulnerableRouteIds.size,
    vulnerableRoutes: vulnerableRouteIds.size,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    violations,
    passed: violations.length === 0,
  };
}

