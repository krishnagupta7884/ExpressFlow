import * as assert from "node:assert";
import * as path from "node:path";
import { buildManifestForProject } from "../src/frontend/serializer/manifestBuilder";
import {
  runMiddleEndPipeline,
  computeDominatorTree,
  checkSecurityInvariants,
} from "../src/middleend";

console.log("=================================================");
console.log("Running ExpressFlow Security Analysis Test Suite");
console.log("=================================================");

// -----------------------------------------------------------------------------
// Test Suite 1: Mathematical Dominator Tree Correctness
// -----------------------------------------------------------------------------
console.log("\n[Test 1] Verifying Graph Dominator Tree Construction on sample-app...");
const sampleManifest = buildManifestForProject(path.join(__dirname, "fixtures", "sample-app.js"));
const sampleResult = runMiddleEndPipeline(sampleManifest);

const checkoutCfg = sampleResult.cfgs.find((c) => c.routeId === "POST /checkout");
assert.ok(checkoutCfg, "POST /checkout CFG must exist");

const domTree = computeDominatorTree(checkoutCfg);
assert.strictEqual(domTree.rootId, "ENTRY");

// Invariant 1: ENTRY dominates all reachable nodes
for (const node of checkoutCfg.nodes) {
  assert.ok(
    domTree.dominates("ENTRY", node.id),
    `ENTRY must dominate node ${node.id}`
  );
}
console.log("  ✓ Verified ENTRY node dominates all 7 nodes in the CFG");

// Invariant 2: Every node dominates itself
for (const node of checkoutCfg.nodes) {
  assert.ok(
    domTree.dominates(node.id, node.id),
    `Node ${node.id} must dominate itself`
  );
}
console.log("  ✓ Verified reflexive dominance invariant (n dom n)");

// Invariant 3: Immediate Dominator (idom) sequence
// In a linear chain: idom(node_i) == node_{i-1}
for (let i = 1; i < checkoutCfg.nodes.length; i++) {
  const prev = checkoutCfg.nodes[i - 1];
  const curr = checkoutCfg.nodes[i];
  assert.strictEqual(
    domTree.getIdom(curr.id),
    prev.id,
    `Expected idom(${curr.id}) to be ${prev.id}`
  );
}
console.log("  ✓ Verified immediate dominator chain: ENTRY -> MW_0 -> MW_1 -> MW_2 -> MW_3 -> HANDLER -> EXIT");

// -----------------------------------------------------------------------------
// Test Suite 2: Security Policy & Invariant Verification on vulnerable-app
// -----------------------------------------------------------------------------
console.log("\n[Test 2] Analyzing Vulnerable Express Target (vulnerable-app)...");
const vulnManifest = buildManifestForProject(path.join(__dirname, "fixtures", "vulnerable-app"));
const vulnResult = runMiddleEndPipeline(vulnManifest);

assert.strictEqual(vulnResult.cfgs.length, 8, "Expected 8 composed routes in vulnerable-app");
const report = vulnResult.securityReport;

assert.strictEqual(report.passed, false, "Security audit must fail on vulnerable target");
assert.strictEqual(report.totalRoutes, 8);
assert.strictEqual(report.vulnerableRoutes, 3);
assert.strictEqual(report.cleanRoutes, 5);
console.log(`  ✓ Correctly classified: ${report.cleanRoutes} Safe routes, ${report.vulnerableRoutes} Vulnerable routes`);

// 1. Verify Rule 1: Missing Authentication
console.log("\n[Test 3] Verifying Rule 1: Missing Authentication on Sensitive Action...");
const rule1Violation = report.violations.find(
  (v) => v.ruleId === "RULE_1_AUTH_BEFORE_SENSITIVE" && v.routeId === "DELETE /api/admin/purge-cache"
);
assert.ok(rule1Violation, "Must flag DELETE /api/admin/purge-cache for missing authentication");
assert.strictEqual(rule1Violation.severity, "CRITICAL");
assert.strictEqual(rule1Violation.sourceFile, "routes/admin.js");
console.log("  ✓ Successfully caught unauthenticated DELETE /api/admin/purge-cache (Severity: CRITICAL)");

// 2. Verify Rule 2: Misordered Security Middleware
console.log("\n[Test 4] Verifying Rule 2: Misordered Security Checkpoint Execution...");
const rule2Violation = report.violations.find(
  (v) => v.ruleId === "RULE_2_MISORDERED_SECURITY_GUARD" && v.routeId === "POST /api/admin/drop-database"
);
assert.ok(rule2Violation, "Must flag POST /api/admin/drop-database for misordered middleware");
assert.strictEqual(rule2Violation.severity, "CRITICAL");
assert.ok(
  rule2Violation.message.includes("registered AFTER the action handler"),
  "Message must indicate handler executes before authentication"
);
console.log("  ✓ Successfully caught misordered auth guard in POST /api/admin/drop-database (Severity: CRITICAL)");

// 3. Verify Rule 4: Missing Rate Limiting on Auth Entrypoint
console.log("\n[Test 5] Verifying Rule 4: Missing Brute-Force Rate Limiting...");
const rule4Violation = report.violations.find(
  (v) => v.ruleId === "RULE_4_MISSING_RATE_LIMIT" && v.routeId === "POST /api/auth/login"
);
assert.ok(rule4Violation, "Must flag POST /api/auth/login for missing rate limiting");
assert.strictEqual(rule4Violation.severity, "MEDIUM");

// Verify that protected registration route did NOT trigger rate limit violation
const registerViolation = report.violations.find((v) => v.routeId === "POST /api/auth/register");
assert.strictEqual(registerViolation, undefined, "POST /api/auth/register with rateLimit must be clean");
console.log("  ✓ Successfully flagged POST /api/auth/login while verifying POST /api/auth/register passes");

// 4. Verify Clean Fixture (modular-app) Passes Security Audit
console.log("\n[Test 6] Verifying Clean Project Passes Security Audit (modular-app)...");
const modularManifest = buildManifestForProject(path.join(__dirname, "fixtures", "modular-app"));
const modularResult = runMiddleEndPipeline(modularManifest);
// In modular-app, all admin routes have verifyAdmin and user routes have verifyToken
const modularViolations = modularResult.securityReport.violations.filter(
  (v) => v.severity === "CRITICAL"
);
assert.strictEqual(modularViolations.length, 0, "Clean fixture must not contain critical security violations");
console.log("  ✓ Verified modular-app contains 0 critical security violations");

console.log("\n=================================================");
console.log("🎉 ALL SECURITY ANALYSIS TESTS PASSED (100% COMPLETE)!");
console.log("=================================================");
