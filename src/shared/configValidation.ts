/**
 * ExpressFlow Configuration Schema Validator
 *
 * Validates the runtime structure of expressflow.config.json to prevent
 * malformed configuration from crashing static analysis or silently bypassing policy.
 */

const VALID_HTTP_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
  "ALL",
  "*",
]);

const BOOLEAN_POLICY_FIELDS = [
  "isPublic",
  "requiresAuth",
  "isAuthEntrypoint",
  "requiresRateLimit",
  "requiresRole",
] as const;

/**
 * Validates the schema of a parsed configuration object against ExpressFlowConfig.
 * Throws an Error with a descriptive message if the configuration structure is invalid.
 */
export function validateExpressFlowConfig(config: unknown): void {
  // Requirement 2: Require the top-level configuration to be a JSON object
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw new Error("Configuration root must be a JSON object.");
  }

  const cfg = config as Record<string, unknown>;

  // Requirement 3: If present, publicRoutes must be an array of strings
  if (cfg.publicRoutes !== undefined) {
    if (!Array.isArray(cfg.publicRoutes)) {
      throw new Error("Field 'publicRoutes' must be an array of strings.");
    }
    for (let i = 0; i < cfg.publicRoutes.length; i++) {
      if (typeof cfg.publicRoutes[i] !== "string") {
        throw new Error(
          `Field 'publicRoutes[${i}]' must be a string, got ${typeof cfg.publicRoutes[i]}.`
        );
      }
    }
  }

  // Requirement 3: If present, authEntrypoints must be an array of strings
  if (cfg.authEntrypoints !== undefined) {
    if (!Array.isArray(cfg.authEntrypoints)) {
      throw new Error("Field 'authEntrypoints' must be an array of strings.");
    }
    for (let i = 0; i < cfg.authEntrypoints.length; i++) {
      if (typeof cfg.authEntrypoints[i] !== "string") {
        throw new Error(
          `Field 'authEntrypoints[${i}]' must be a string, got ${typeof cfg.authEntrypoints[i]}.`
        );
      }
    }
  }

  // Requirement 4: If present, policies must be an array of objects
  if (cfg.policies !== undefined) {
    if (!Array.isArray(cfg.policies)) {
      throw new Error("Field 'policies' must be an array of policy rule objects.");
    }

    for (let i = 0; i < cfg.policies.length; i++) {
      const rule = cfg.policies[i];
      if (typeof rule !== "object" || rule === null || Array.isArray(rule)) {
        throw new Error(`Policy rule at 'policies[${i}]' must be an object.`);
      }

      // Valid path value: string or RegExp
      const pathVal = (rule as Record<string, unknown>).path;
      if (typeof pathVal !== "string" && !(pathVal instanceof RegExp)) {
        throw new Error(
          `Policy rule at 'policies[${i}]' must have a valid 'path' (string or RegExp), got ${typeof pathVal}.`
        );
      }

      // Supported HTTP method
      const methodVal = (rule as Record<string, unknown>).method;
      if (methodVal !== undefined) {
        if (
          typeof methodVal !== "string" ||
          !VALID_HTTP_METHODS.has(methodVal.toUpperCase())
        ) {
          throw new Error(
            `Policy rule at 'policies[${i}]' has unsupported HTTP method '${String(methodVal)}'.`
          );
        }
      }

      // Correctly typed boolean policy fields
      for (const field of BOOLEAN_POLICY_FIELDS) {
        const val = (rule as Record<string, unknown>)[field];
        if (val !== undefined && typeof val !== "boolean") {
          throw new Error(
            `Policy rule at 'policies[${i}]' field '${field}' must be a boolean, got ${typeof val}.`
          );
        }
      }
    }
  }
}

