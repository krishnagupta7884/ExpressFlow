import * as fs from "fs";
import * as path from "path";
import { AnalysisDiagnostics, FileDiagnostic, HttpMethod } from "../../shared/types/manifest";
import { RouteCfg } from "../cfg/cfgModel";
import { validateExpressFlowConfig } from "../../shared/configValidation";

export { validateExpressFlowConfig };

export interface RoutePolicyRule {
  /** HTTP method ("GET", "POST", etc.) or "*" for any method */
  method?: HttpMethod | "*";
  /** Path string (e.g. "/api/users", "/health") or RegExp */
  path: string | RegExp;
  /** Explicitly marks route as public (does not require authentication) */
  isPublic?: boolean;
  /** Explicitly marks route as requiring authentication */
  requiresAuth?: boolean;
  /** Explicitly marks route as an authentication/credential entrypoint */
  isAuthEntrypoint?: boolean;
  /** Explicitly marks route as requiring brute-force rate-limiting */
  requiresRateLimit?: boolean;
  /** Explicitly marks route as requiring elevated/administrative role authorization */
  requiresRole?: boolean;
}

export interface ExpressFlowConfig {
  /** Ordered list of route policy rules */
  policies?: RoutePolicyRule[];
  /** Shorthand list of public routes, e.g. ["POST /api/users", "GET /health"] */
  publicRoutes?: string[];
  /** Shorthand list of auth entrypoint routes, e.g. ["POST /api/users/login"] */
  authEntrypoints?: string[];
}

export interface ConfigLoadResult {
  config?: ExpressFlowConfig;
  diagnostic?: FileDiagnostic;
}

/**
 * Attempts to load an optional `expressflow.config.json` from a project directory.
 * If the configuration file exists but is unreadable or malformed, it records a
 * structured diagnostic and updates diagnostics status to INCOMPLETE.
 */
export function loadProjectConfig(
  projectRoot: string,
  diagnostics?: AnalysisDiagnostics
): ExpressFlowConfig | undefined {
  const configPath = path.join(projectRoot, "expressflow.config.json");
  if (!fs.existsSync(configPath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);
    validateExpressFlowConfig(parsed);
    return parsed as ExpressFlowConfig;
  } catch (err: any) {
    const errorMsg = `Invalid or unreadable configuration file: ${err?.message || String(err)}`;
    const relativePath =
      path.relative(projectRoot, configPath).replace(/\\/g, "/") || "expressflow.config.json";
    const diag: FileDiagnostic = {
      filePath: relativePath,
      error: errorMsg,
    };

    if (diagnostics) {
      const alreadyReported = diagnostics.errors.some((e) => e.filePath === relativePath);
      if (!alreadyReported) {
        diagnostics.errors.push(diag);
        diagnostics.failedFiles += 1;
        diagnostics.status = "INCOMPLETE";
        diagnostics.statusMessage = diagnostics.statusMessage
          ? `${diagnostics.statusMessage} Invalid configuration file: ${relativePath}.`
          : errorMsg;
      }
    }

    return undefined;
  }
}

/**
 * Helper to load project config and return both config and any diagnostic.
 */
export function loadProjectConfigWithDiagnostic(
  projectRoot: string
): ConfigLoadResult {
  const diagHolder: AnalysisDiagnostics = {
    status: "COMPLETE",
    statusMessage: "",
    discoveredFiles: 0,
    analyzedFiles: 0,
    failedFiles: 0,
    errors: [],
  };
  const config = loadProjectConfig(projectRoot, diagHolder);
  return {
    config,
    diagnostic: diagHolder.errors[0],
  };
}

/**
 * Normalizes a URL path for uniform comparison (removes trailing slashes unless root).
 */
function normalizeUrlPath(urlPath: string): string {
  if (urlPath.length > 1 && urlPath.endsWith("/")) {
    return urlPath.slice(0, -1);
  }
  return urlPath;
}

/**
 * Checks if a string pattern matches a given URL path.
 * Supports exact match, trailing wildcards (*), and optional /api prefixes.
 */
function matchesPathPattern(pattern: string | RegExp, fullPath: string): boolean {
  const normFullPath = normalizeUrlPath(fullPath);

  if (pattern instanceof RegExp) {
    return pattern.test(normFullPath);
  }

  const normPattern = normalizeUrlPath(pattern);
  if (normPattern.endsWith("/*")) {
    const base = normPattern.slice(0, -2);
    return normFullPath === base || normFullPath.startsWith(base + "/");
  }

  if (normFullPath === normPattern) {
    return true;
  }

  // Also support matching paths without leading /api if route has /api
  if (normFullPath.startsWith("/api/") && normPattern === normFullPath.slice(4)) {
    return true;
  }

  return false;
}

/**
 * Evaluates whether a route matches a method/path specifier string like "POST /api/users" or "/health".
 */
function matchesSpecifier(specifier: string, method: HttpMethod, fullPath: string): boolean {
  const parts = specifier.trim().split(/\s+/);
  if (parts.length === 2) {
    const [specMethod, specPath] = parts;
    if (specMethod.toUpperCase() !== method && specMethod !== "*") {
      return false;
    }
    return matchesPathPattern(specPath, fullPath);
  } else if (parts.length === 1) {
    return matchesPathPattern(parts[0], fullPath);
  }
  return false;
}

// -----------------------------------------------------------------------------
// Built-in Route Classifications (Precise Method & Path Definitions)
// -----------------------------------------------------------------------------

// 1. Built-in public registration paths (strictly POST)
const PUBLIC_REGISTRATION_PATHS = new Set([
  "/users",
  "/api/users",
  "/register",
  "/api/register",
  "/signup",
  "/api/signup",
  "/auth/register",
  "/api/auth/register",
  "/auth/signup",
  "/api/auth/signup",
]);

// 2. Built-in public login / credential verification paths (strictly POST)
const PUBLIC_LOGIN_PATHS = new Set([
  "/login",
  "/api/login",
  "/users/login",
  "/api/users/login",
  "/signin",
  "/api/signin",
  "/auth/login",
  "/api/auth/login",
  "/auth/signin",
  "/api/auth/signin",
  "/sessions",
  "/api/sessions",
  "/forgot-password",
  "/api/forgot-password",
  "/reset-password",
  "/api/reset-password",
]);

// 3. Built-in public informational/health paths (strictly GET)
const PUBLIC_INFO_PATHS = new Set([
  "/",
  "/health",
  "/status",
  "/ping",
  "/live",
  "/ready",
  "/favicon.ico",
  "/robots.txt",
  "/docs",
  "/swagger",
  "/tags",
  "/api/tags",
]);

// 4. Built-in administrative path prefixes
const ADMIN_PREFIXES = ["/admin", "/api/admin", "/system", "/api/system"];

/**
 * Evaluates whether a route is explicitly or conventionally classified as public (no auth required).
 */
export function isPublicRoute(cfg: RouteCfg, config?: ExpressFlowConfig): boolean {
  const normPath = normalizeUrlPath(cfg.fullPath);

  // 1. User-configured public routes list
  if (Array.isArray(config?.publicRoutes)) {
    for (const spec of config.publicRoutes) {
      if (typeof spec === "string" && matchesSpecifier(spec, cfg.method, normPath)) {
        return true;
      }
    }
  }

  // 2. User-configured policy rules
  if (Array.isArray(config?.policies)) {
    for (const rule of config.policies) {
      if (rule && rule.method && rule.method !== "*" && rule.method !== cfg.method) {
        continue;
      }
      if (rule && rule.path && matchesPathPattern(rule.path, normPath)) {
        if (rule.isPublic === true) return true;
        if (rule.isPublic === false || rule.requiresAuth === true) return false;
      }
    }
  }

  // 3. Built-in: Health and informational endpoints (GET)
  if (cfg.method === "GET" && PUBLIC_INFO_PATHS.has(normPath)) {
    return true;
  }

  // 4. Built-in: User registration endpoints (POST only)
  if (cfg.method === "POST" && PUBLIC_REGISTRATION_PATHS.has(normPath)) {
    return true;
  }

  // 5. Built-in: User login endpoints (POST only)
  if (cfg.method === "POST" && PUBLIC_LOGIN_PATHS.has(normPath)) {
    return true;
  }

  // 6. Built-in: Public read-only articles/profiles in RealWorld Conduit spec
  if (
    cfg.method === "GET" &&
    (normPath === "/articles" ||
      normPath === "/api/articles" ||
      normPath.startsWith("/articles/") ||
      normPath.startsWith("/api/articles/") ||
      normPath.startsWith("/profiles/") ||
      normPath.startsWith("/api/profiles/")) &&
    !normPath.includes("/feed") // /articles/feed is private
  ) {
    return true;
  }

  return false;
}

/**
 * Evaluates whether a route is an authentication or credential entrypoint.
 */
export function isAuthEntrypoint(cfg: RouteCfg, config?: ExpressFlowConfig): boolean {
  const normPath = normalizeUrlPath(cfg.fullPath);

  // User-configured entrypoints
  if (Array.isArray(config?.authEntrypoints)) {
    for (const spec of config.authEntrypoints) {
      if (typeof spec === "string" && matchesSpecifier(spec, cfg.method, normPath)) {
        return true;
      }
    }
  }

  if (Array.isArray(config?.policies)) {
    for (const rule of config.policies) {
      if (rule && rule.method && rule.method !== "*" && rule.method !== cfg.method) {
        continue;
      }
      if (rule && rule.path && matchesPathPattern(rule.path, normPath)) {
        if (rule.isAuthEntrypoint !== undefined) return rule.isAuthEntrypoint;
      }
    }
  }

  // Built-in: POST login, registration, password resets
  if (cfg.method === "POST") {
    if (PUBLIC_LOGIN_PATHS.has(normPath) || PUBLIC_REGISTRATION_PATHS.has(normPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates whether a route requires brute-force rate-limiting.
 * Enforces rate limiting on sensitive authentication/login entrypoints.
 */
export function requiresRateLimiting(cfg: RouteCfg, config?: ExpressFlowConfig): boolean {
  const normPath = normalizeUrlPath(cfg.fullPath);

  // 1. User-configured authEntrypoints list
  if (Array.isArray(config?.authEntrypoints)) {
    for (const spec of config.authEntrypoints) {
      if (typeof spec === "string" && matchesSpecifier(spec, cfg.method, normPath)) {
        return true;
      }
    }
  }

  // 2. User-configured policy rules
  if (Array.isArray(config?.policies)) {
    for (const rule of config.policies) {
      if (rule && rule.method && rule.method !== "*" && rule.method !== cfg.method) {
        continue;
      }
      if (rule && rule.path && matchesPathPattern(rule.path, normPath)) {
        if (rule.requiresRateLimit !== undefined) return rule.requiresRateLimit;
        if (rule.isAuthEntrypoint === true) return true;
      }
    }
  }

  // 3. High-risk credential entrypoints (login, checkout, password resets) require rate-limiting
  if (cfg.method === "POST") {
    if (PUBLIC_LOGIN_PATHS.has(normPath) || normPath.endsWith("/checkout") || normPath.endsWith("/login")) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluates whether a route requires administrative role-based authorization.
 */
export function requiresRoleAuthorization(cfg: RouteCfg, config?: ExpressFlowConfig): boolean {
  const normPath = normalizeUrlPath(cfg.fullPath);

  if (Array.isArray(config?.policies)) {
    for (const rule of config.policies) {
      if (rule && rule.method && rule.method !== "*" && rule.method !== cfg.method) {
        continue;
      }
      if (rule && rule.path && matchesPathPattern(rule.path, normPath)) {
        if (rule.requiresRole !== undefined) return rule.requiresRole;
      }
    }
  }

  for (const prefix of ADMIN_PREFIXES) {
    if (normPath === prefix || normPath.startsWith(prefix + "/")) {
      return true;
    }
  }

  if (
    normPath.includes("/purge") ||
    normPath.includes("/drop-database") ||
    normPath.includes("/restart") ||
    normPath.includes("/execute")
  ) {
    return true;
  }

  return false;
}

/**
 * Evaluates whether a route represents a sensitive operation requiring authentication.
 */
export function requiresAuthentication(cfg: RouteCfg, config?: ExpressFlowConfig): boolean {
  const normPath = normalizeUrlPath(cfg.fullPath);

  // 1. Explicit user policies
  if (Array.isArray(config?.policies)) {
    for (const rule of config.policies) {
      if (rule && rule.method && rule.method !== "*" && rule.method !== cfg.method) {
        continue;
      }
      if (rule && rule.path && matchesPathPattern(rule.path, normPath)) {
        if (rule.requiresAuth !== undefined) return rule.requiresAuth;
        if (rule.isPublic === true) return false;
      }
    }
  }

  // 2. If classified as public, authentication is NOT required
  if (isPublicRoute(cfg, config)) {
    return false;
  }

  // 3. Administrative routes always require authentication
  if (requiresRoleAuthorization(cfg, config)) {
    return true;
  }

  // 4. State-mutating HTTP methods (DELETE, PUT, PATCH) are sensitive by definition
  if (["DELETE", "PUT", "PATCH"].includes(cfg.method)) {
    return true;
  }

  // 5. Protected user identity endpoints (GET /user, GET /api/user, GET /me, etc.)
  if (
    cfg.method === "GET" &&
    (normPath === "/user" ||
      normPath === "/api/user" ||
      normPath === "/me" ||
      normPath === "/api/me" ||
      normPath === "/profile" ||
      normPath === "/api/users/profile" ||
      normPath === "/articles/feed" ||
      normPath === "/api/articles/feed")
  ) {
    return true;
  }

  // 6. Sensitive operational POST endpoints
  if (
    cfg.method === "POST" &&
    (normPath.includes("/checkout") ||
      normPath.includes("/payment") ||
      normPath.includes("/billing") ||
      normPath.includes("/database") ||
      normPath.includes("/purge") ||
      normPath.includes("/drop") ||
      normPath.includes("/settings") ||
      normPath.includes("/follow"))
  ) {
    return true;
  }

  return false;
}
