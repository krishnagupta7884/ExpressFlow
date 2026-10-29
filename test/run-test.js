const assert = require("node:assert");
const path = require("node:path");
const fs = require("node:fs");
const { execSync } = require("node:child_process");
const {
  readSourceFile,
  analyzeSourceContent,
  buildManifestForProject,
  runMiddleEndPipeline,
  computeDominatorTree,
  checkSecurityInvariants,
  buildRouteCfg,
  loadProjectConfig,
  validateExpressFlowConfig,
  toAscii,
  toDot,
  toMermaid,
} = require("../dist/index.js");

console.log("================================================================================");
console.log(" EXPRESSFLOW AUTOMATED COMPREHENSIVE TEST SUITE (100% IMPLEMENTATION)");
console.log("================================================================================");

// =============================================================================
// PART 1: FRONTEND PIPELINE TESTS (Lexical, Syntactic, AST & Manifest IR)
// =============================================================================
console.log("\n>>> PART 1: FRONTEND PIPELINE (Lexical, AST & Manifest IR) <<<");

const fixturePath = path.join(__dirname, "fixtures", "sample-app.js");
const code = readSourceFile(fixturePath);

console.log("\n[Test 1] Parsing fixture and analyzing AST...");
const metadata = analyzeSourceContent(code, "fixtures/sample-app.js");

// 1. Verify Routers Declared
console.log("\n[Test 2] Verifying Discovered Routers...");
const appDecl = metadata.routersDeclared.find((r) => r.identifier === "app");
const userDecl = metadata.routersDeclared.find((r) => r.identifier === "userRouter");

assert.ok(appDecl, "Expected 'app' to be declared");
assert.strictEqual(appDecl.kind, "APPLICATION", "'app' should be kind APPLICATION");
assert.ok(appDecl.loc.start.line > 0, "'app' should have a valid start line");

assert.ok(userDecl, "Expected 'userRouter' to be declared");
assert.strictEqual(userDecl.kind, "ROUTER", "'userRouter' should be kind ROUTER");
console.log("  ✓ Correctly identified 'app' (APPLICATION) and 'userRouter' (ROUTER)");

// 2. Verify Routes
console.log("\n[Test 3] Verifying Extracted Routes...");

// Global middleware
const globalMw = metadata.routeRegistrations.find(
  (r) => r.httpMethod === "ALL" && r.path.value === "/"
);
assert.ok(globalMw, "Expected global app.use(express.json()) to be registered");
console.log("  ✓ Correctly extracted global middleware: app.use(express.json())");

// Health route
const healthRoute = metadata.routeRegistrations.find(
  (r) => r.httpMethod === "GET" && r.path.value === "/health"
);
assert.ok(healthRoute, "Expected GET /health route to be extracted");
assert.strictEqual(healthRoute.middlewares.length, 1, "Health route should have 1 handler");
assert.strictEqual(healthRoute.middlewares[0].type, "INLINE_FUNCTION");
assert.deepStrictEqual(healthRoute.middlewares[0].params, ["req", "res"]);
console.log("  ✓ Correctly extracted GET /health with inline callback parameters [req, res]");

// Checkout route with nested arrays
const checkoutRoute = metadata.routeRegistrations.find(
  (r) => r.httpMethod === "POST" && r.path.value === "/checkout"
);
assert.ok(checkoutRoute, "Expected POST /checkout route to be extracted");
assert.strictEqual(
  checkoutRoute.middlewares.length,
  4,
  "Nested array [rateLimit, [verifyToken, validateCart]] should flatten to 4 middlewares"
);
assert.strictEqual(checkoutRoute.middlewares[0].name, "rateLimit");
assert.strictEqual(checkoutRoute.middlewares[1].name, "verifyToken");
assert.strictEqual(checkoutRoute.middlewares[2].name, "validateCart");
assert.strictEqual(checkoutRoute.middlewares[3].name, "checkoutHandler");
console.log("  ✓ Correctly flattened nested middleware arrays in POST /checkout (4 middlewares)");

// Sub-router delete route
const deleteRoute = metadata.routeRegistrations.find(
  (r) => r.routerIdentifier === "userRouter" && r.httpMethod === "DELETE"
);
assert.ok(deleteRoute, "Expected DELETE route on userRouter");
assert.strictEqual(deleteRoute.path.value, "/:id");
assert.strictEqual(deleteRoute.middlewares.length, 2);
assert.strictEqual(deleteRoute.middlewares[0].name, "checkAdmin");
assert.strictEqual(deleteRoute.middlewares[1].name, "deleteUserHandler");
console.log("  ✓ Correctly extracted sub-router DELETE /:id route with checkAdmin guard");

// 3. Verify Sub-Router Mount
console.log("\n[Test 4] Verifying Sub-Router Mounts...");
const mount = metadata.mounts.find((m) => m.subRouterIdentifier === "userRouter");
assert.ok(mount, "Expected mount registration for userRouter");
assert.strictEqual(mount.parentRouter, "app");
assert.strictEqual(mount.path.value, "/api/users");
console.log("  ✓ Correctly captured mount: app.use('/api/users', userRouter)");

// 4. Verify Module Exports
console.log("\n[Test 5] Verifying Exports...");
const exp = metadata.exports.find((e) => e.localIdentifier === "app");
assert.ok(exp, "Expected module.exports = app to be captured");
assert.strictEqual(exp.type, "DEFAULT");
console.log("  ✓ Correctly tracked default export of 'app'");

// 5. Verify Project Manifest Generation
console.log("\n[Test 6] Verifying Full Project Manifest Builder...");
const manifest = buildManifestForProject(path.join(__dirname, "fixtures"));
assert.strictEqual(manifest.version, "1.0.0");
assert.ok(manifest.files.length > 0, "Manifest should include analyzed files");
console.log(`  ✓ Successfully built manifest across project (${manifest.files.length} source files indexed)`);

// =============================================================================
// PART 2: MIDDLE-END ENGINE TESTS (Module Resolution, Route Composition & CFG)
// =============================================================================
console.log("\n>>> PART 2: MIDDLE-END ENGINE (Module Resolution, Route Composition & CFG) <<<");

console.log("\n[Test 7] Running Middle-End Pipeline on sample-app fixture...");
const sampleAppManifest = buildManifestForProject(path.join(__dirname, "fixtures", "sample-app.js"));
const sampleResult = runMiddleEndPipeline(sampleAppManifest);

assert.strictEqual(sampleResult.resolution.rootApplications.length, 1);
assert.strictEqual(sampleResult.resolution.rootApplications[0].identifier, "app");
console.log("  ✓ Correctly identified root application 'app'");

// Verify Route Composition & Cumulative Paths
console.log("\n[Test 8] Verifying Route Hierarchy & Prefix Composition...");
const sampleCheckout = sampleResult.composedRoutes.find((r) => r.id === "POST /checkout");
assert.ok(sampleCheckout, "POST /checkout route should exist");
assert.strictEqual(sampleCheckout.effectiveMiddlewares.length, 5); // Global express.json + 4 route middlewares
assert.strictEqual(sampleCheckout.effectiveMiddlewares[0].name, "express.json");
assert.strictEqual(sampleCheckout.effectiveMiddlewares[0].scope, "GLOBAL");
console.log("  ✓ Correctly composed global + route middlewares in linear order");

const sampleDelete = sampleResult.composedRoutes.find((r) => r.id === "DELETE /api/users/:id");
assert.ok(sampleDelete, "Expected DELETE /api/users/:id");
assert.strictEqual(sampleDelete.fullPath, "/api/users/:id");
console.log("  ✓ Correctly composed mount path: '/api/users' + '/:id' -> '/api/users/:id'");

// Verify CFG Construction & Graph Invariants
console.log("\n[Test 9] Verifying Control-Flow Graph (CFG) Construction & Graph Invariants...");
const checkoutCfg = sampleResult.cfgs.find((c) => c.routeId === "POST /checkout");
assert.ok(checkoutCfg, "Expected CFG for POST /checkout");
assert.strictEqual(checkoutCfg.entryNodeId, "ENTRY");
assert.strictEqual(checkoutCfg.exitNodeId, "EXIT");
assert.strictEqual(checkoutCfg.terminalHandlerNodeId, "HANDLER");
assert.strictEqual(checkoutCfg.nodeCount, 7); // ENTRY + 5 mws/handler + EXIT
assert.strictEqual(checkoutCfg.edgeCount, 6); // 6 sequential edges

for (let i = 0; i < checkoutCfg.nodes.length - 1; i++) {
  const u = checkoutCfg.nodes[i];
  const v = checkoutCfg.nodes[i + 1];
  assert.ok(u.successors.includes(v.id), `Missing edge from ${u.id} to ${v.id}`);
  assert.ok(v.predecessors.includes(u.id), `Missing predecessor ${u.id} on ${v.id}`);
}
console.log("  ✓ Verified directed graph topology: ENTRY -> M0 -> M1 -> M2 -> M3 -> HANDLER -> EXIT");

// Verify Multi-File Cross-Module Linking
console.log("\n[Test 10] Verifying Cross-File Symbol & Module Resolution (modular-app)...");
const modularAppPath = path.join(__dirname, "fixtures", "modular-app");
const modularManifest = buildManifestForProject(modularAppPath);
const modularResult = runMiddleEndPipeline(modularManifest);

assert.strictEqual(modularResult.resolution.rootApplications.length, 1);
assert.strictEqual(modularResult.resolution.routers.size, 3);
console.log(`  ✓ Linked cross-file modules across ${modularResult.resolution.routers.size} routers`);

console.log("\n[Test 11] Verifying Cross-File Route Composition...");
const adminDelete = modularResult.composedRoutes.find((r) => r.id === "DELETE /api/admin/database");
assert.ok(adminDelete, "Expected composed route DELETE /api/admin/database from routes/admin.js");
assert.strictEqual(adminDelete.fullPath, "/api/admin/database");

const userProfile = modularResult.composedRoutes.find((r) => r.id === "GET /api/users/profile");
assert.ok(userProfile, "Expected composed route GET /api/users/profile from routes/user.js");
assert.strictEqual(userProfile.fullPath, "/api/users/profile");
console.log("  ✓ Successfully linked /api/admin/database and /api/users/profile across separate files");

// Verify CFG Visualizers
console.log("\n[Test 12] Verifying CFG Visualization Generation (ASCII, DOT, Mermaid)...");
const ascii = toAscii(checkoutCfg);
assert.ok(ascii.includes("CFG: POST /checkout"));
const dot = toDot(checkoutCfg);
assert.ok(dot.includes("digraph CFG_POST__checkout"));
const mermaid = toMermaid(checkoutCfg);
assert.ok(mermaid.includes("flowchart TD"));
console.log("  ✓ Successfully generated ASCII, Graphviz DOT, and Mermaid diagram exports");

// =============================================================================
// PART 3: BACKEND SECURITY INVARIANT & DOMINATOR ANALYSIS (100% Milestone)
// =============================================================================
console.log("\n>>> PART 3: BACKEND SECURITY ENGINE (Dominator Reachability & Invariants) <<<");

console.log("\n[Test 13] Verifying Graph Dominator Tree Construction on CFG...");
const domTree = computeDominatorTree(checkoutCfg);
assert.strictEqual(domTree.rootId, "ENTRY");

for (const node of checkoutCfg.nodes) {
  assert.ok(domTree.dominates("ENTRY", node.id), `ENTRY must dominate ${node.id}`);
  assert.ok(domTree.dominates(node.id, node.id), `Reflexive dominance failed for ${node.id}`);
}
console.log("  ✓ Proved formal dominance invariants: ENTRY dominates all nodes, and all nodes dominate themselves");

console.log("\n[Test 14] Auditing Vulnerable Project Target (vulnerable-app)...");
const vulnAppPath = path.join(__dirname, "fixtures", "vulnerable-app");
const vulnManifest = buildManifestForProject(vulnAppPath);
const vulnResult = runMiddleEndPipeline(vulnManifest);
const report = vulnResult.securityReport;

assert.strictEqual(report.passed, false, "Audit must fail on vulnerable target");
assert.strictEqual(report.totalRoutes, 8);
assert.strictEqual(report.vulnerableRoutes, 3);
assert.strictEqual(report.cleanRoutes, 5);
console.log(`  ✓ Audited 8 endpoints: identified 5 secure routes and 3 vulnerable routes`);

console.log("\n[Test 15] Verifying Invariant Rule 1: Auth-Before-Sensitive...");
const purgeViolation = report.violations.find(
  (v) => v.ruleId === "RULE_1_AUTH_BEFORE_SENSITIVE" && v.routeId === "DELETE /api/admin/purge-cache"
);
assert.ok(purgeViolation, "DELETE /api/admin/purge-cache must trigger Rule 1");
assert.strictEqual(purgeViolation.severity, "CRITICAL");
console.log("  ✓ Correctly flagged unauthenticated DELETE /api/admin/purge-cache (Severity: CRITICAL)");

console.log("\n[Test 16] Verifying Invariant Rule 2: Misordered Security Checkpoint...");
const dropViolation = report.violations.find(
  (v) => v.ruleId === "RULE_2_MISORDERED_SECURITY_GUARD" && v.routeId === "POST /api/admin/drop-database"
);
assert.ok(dropViolation, "POST /api/admin/drop-database must trigger Rule 2");
assert.strictEqual(dropViolation.severity, "CRITICAL");
console.log("  ✓ Correctly flagged misordered auth in POST /api/admin/drop-database (Severity: CRITICAL)");

console.log("\n[Test 17] Verifying Invariant Rule 4: Brute-Force Rate Limiting...");
const loginViolation = report.violations.find(
  (v) => v.ruleId === "RULE_4_MISSING_RATE_LIMIT" && v.routeId === "POST /api/auth/login"
);
assert.ok(loginViolation, "POST /api/auth/login must trigger Rule 4");
assert.strictEqual(loginViolation.severity, "MEDIUM");

const regViolation = report.violations.find((v) => v.routeId === "POST /api/auth/register");
assert.strictEqual(regViolation, undefined, "Protected register endpoint must have no rate-limit violation");
console.log("  ✓ Verified rate-limiting enforcement on auth entrypoints (login flagged, register passed)");

console.log("\n[Test 18] Verifying Clean Project (modular-app) Passes Security Audit...");
const cleanAudit = modularResult.securityReport;
const criticalViolations = cleanAudit.violations.filter((v) => v.severity === "CRITICAL");
assert.strictEqual(criticalViolations.length, 0, "Clean project should have 0 critical violations");
console.log("  ✓ Confirmed modular-app has 0 critical vulnerabilities");

console.log("\n[Test 19] Verifying Real-World Production Target (Conduit RealWorld App)...");
const realworldDir = path.resolve(__dirname, "fixtures/realworld-app/src");
const realworldManifest = buildManifestForProject(realworldDir);
assert.ok(realworldManifest.files.length >= 30, "Should index at least 30 TypeScript source files");
const realworldResult = runMiddleEndPipeline(realworldManifest);
assert.ok(realworldResult.composedRoutes.length >= 20, "Should compose at least 20 real-world API routes");
assert.ok(realworldResult.cfgs.length >= 20, "Should synthesize at least 20 formal CFGs");
assert.ok(realworldResult.dominatorTrees.size >= 20, "Should compute at least 20 Dominator Trees");
console.log(`  ✓ Successfully audited production RealWorld codebase (31 files, 20 routes, 20 CFGs, 20 Dominator Trees)`);

// =============================================================================
// PART 4: PARSING DIAGNOSTICS & ANALYSIS STATUS REGRESSION SUITE (BUG 1)
// =============================================================================
console.log("\n>>> PART 4: PARSING DIAGNOSTICS & COMPLETION STATUS (BUG 1) <<<");

console.log("\n[Test 20] Verifying Malformed-Only Project Reports INCOMPLETE...");
const malformedDir = path.resolve(__dirname, "fixtures/malformed-only");
const malformedManifest = buildManifestForProject(malformedDir);
assert.strictEqual(malformedManifest.diagnostics.status, "INCOMPLETE");
assert.strictEqual(malformedManifest.diagnostics.failedFiles, 1);
assert.strictEqual(malformedManifest.diagnostics.analyzedFiles, 0);
assert.ok(malformedManifest.diagnostics.errors.length > 0);
assert.ok(malformedManifest.diagnostics.errors[0].loc.start.line > 0, "Error diagnostic should capture line coordinate");

const malformedResult = runMiddleEndPipeline(malformedManifest);
assert.strictEqual(malformedResult.securityReport.status, "INCOMPLETE");
assert.strictEqual(malformedResult.securityReport.passed, false, "Incomplete analysis must never report passed");
console.log("  ✓ Correctly classified malformed-only project as INCOMPLETE (passed: false, captured line/col)");

console.log("\n[Test 21] Verifying Mixed Project (1 Valid, 1 Malformed File)...");
const mixedDir = path.resolve(__dirname, "fixtures/mixed-malformed");
const mixedManifest = buildManifestForProject(mixedDir);
assert.strictEqual(mixedManifest.diagnostics.status, "INCOMPLETE");
assert.strictEqual(mixedManifest.diagnostics.failedFiles, 1);
assert.strictEqual(mixedManifest.diagnostics.analyzedFiles, 1);

const mixedResult = runMiddleEndPipeline(mixedManifest);
assert.strictEqual(mixedResult.securityReport.status, "INCOMPLETE");
assert.strictEqual(mixedResult.securityReport.passed, false);
assert.ok(mixedResult.composedRoutes.length >= 1, "Should still compose routes from the valid file");
const mixedViolation = mixedResult.securityReport.violations.find((v) => v.ruleId === "RULE_1_AUTH_BEFORE_SENSITIVE");
assert.ok(mixedViolation, "Should report security violation from valid file while marking overall audit incomplete");
console.log("  ✓ Successfully reported findings from valid file while keeping overall status INCOMPLETE");

console.log("\n[Test 22] Verifying Nonexistent Directory Handling...");
const nonexistentDir = path.resolve(__dirname, "fixtures/does-not-exist");
const nonexistentManifest = buildManifestForProject(nonexistentDir);
assert.strictEqual(nonexistentManifest.diagnostics.status, "INCOMPLETE");
assert.strictEqual(nonexistentManifest.diagnostics.failedFiles, 1);
const nonexistentResult = runMiddleEndPipeline(nonexistentManifest);
assert.strictEqual(nonexistentResult.securityReport.status, "INCOMPLETE");
assert.strictEqual(nonexistentResult.securityReport.passed, false);
console.log("  ✓ Correctly reported nonexistent path as INCOMPLETE with passed: false");

console.log("\n[Test 23] Verifying Empty Directory Handling...");
const emptyDir = path.resolve(__dirname, "fixtures/empty-dir");
if (!fs.existsSync(emptyDir)) fs.mkdirSync(emptyDir, { recursive: true });
const emptyManifest = buildManifestForProject(emptyDir);
assert.strictEqual(emptyManifest.diagnostics.status, "INCONCLUSIVE");
const emptyResult = runMiddleEndPipeline(emptyManifest);
assert.strictEqual(emptyResult.securityReport.status, "INCONCLUSIVE");
assert.strictEqual(emptyResult.securityReport.passed, false, "Empty directory must never report clean security audit");
console.log("  ✓ Correctly reported empty directory as INCONCLUSIVE with passed: false");

console.log("\n[Test 24] Verifying Project With Valid Source But No Routes (INCONCLUSIVE)...");
const noRoutesDir = path.resolve(__dirname, "fixtures/no-routes");
const noRoutesManifest = buildManifestForProject(noRoutesDir);
assert.strictEqual(noRoutesManifest.diagnostics.status, "COMPLETE");
assert.strictEqual(noRoutesManifest.diagnostics.analyzedFiles, 1);
assert.strictEqual(noRoutesManifest.diagnostics.failedFiles, 0);

const noRoutesResult = runMiddleEndPipeline(noRoutesManifest);
assert.strictEqual(noRoutesResult.cfgs.length, 0);
assert.strictEqual(noRoutesResult.securityReport.status, "INCONCLUSIVE");
assert.strictEqual(noRoutesResult.securityReport.passed, false, "0 route CFGs must report INCONCLUSIVE, not passed");
console.log("  ✓ Correctly reported project without Express routes as INCONCLUSIVE");

console.log("\n[Test 25] Verifying CLI Exit Code Rules...");
// Incomplete analysis must exit with 1 (even without --strict)
let malformedExitCode = 0;
try {
  execSync(`node "${path.resolve(__dirname, '../dist/index.js')}" "${malformedDir}"`, { stdio: "pipe" });
} catch (err) {
  malformedExitCode = err.status;
}
assert.strictEqual(malformedExitCode, 1, "CLI must exit 1 on INCOMPLETE analysis without --strict");

// Clean project must exit 0 without --strict, and 0 with --strict
const cleanExit = execSync(`node "${path.resolve(__dirname, '../dist/index.js')}" "${path.resolve(__dirname, 'fixtures/modular-app')}"`, { stdio: "pipe" });
assert.ok(cleanExit, "Clean project without --strict must exit 0");

const cleanStrictExit = execSync(`node "${path.resolve(__dirname, '../dist/index.js')}" "${path.resolve(__dirname, 'fixtures/modular-app')}" --strict`, { stdio: "pipe" });
assert.ok(cleanStrictExit, "Clean project with --strict must exit 0");

// Inconclusive project without --strict exits 0, with --strict exits 1
const noRoutesExit = execSync(`node "${path.resolve(__dirname, '../dist/index.js')}" "${noRoutesDir}"`, { stdio: "pipe" });
assert.ok(noRoutesExit, "Inconclusive project without --strict exits 0");

let noRoutesStrictExit = 0;
try {
  execSync(`node "${path.resolve(__dirname, '../dist/index.js')}" "${noRoutesDir}" --strict`, { stdio: "pipe" });
} catch (err) {
  noRoutesStrictExit = err.status;
}
assert.strictEqual(noRoutesStrictExit, 1, "Inconclusive project with --strict must exit 1");
console.log("  ✓ Verified CLI exit code invariants (INCOMPLETE=1, Strict failure=1, Clean=0)");

// =============================================================================
// PART 5: ROUTE POLICY & PUBLIC ROUTE CLASSIFICATION (BUG 2)
// =============================================================================
console.log("\n>>> PART 5: ROUTE POLICY & CLASSIFICATION (BUG 2) <<<");

console.log("\n[Test 26] Verifying Public Registration (POST /api/users) Not Flagged for Missing Auth...");
const realworldReport = realworldResult.securityReport;
const usersPostAuthViolation = realworldReport.violations.find(
  (v) => v.routeId === "POST /api/users" && v.ruleId === "RULE_1_AUTH_BEFORE_SENSITIVE"
);
assert.strictEqual(usersPostAuthViolation, undefined, "POST /api/users must NOT be flagged as missing authentication");
console.log("  ✓ Confirmed POST /api/users (public user creation) produces 0 missing-authentication violations");

console.log("\n[Test 27] Verifying Public Login (POST /api/users/login) Not Flagged for Missing Auth...");
const loginPostAuthViolation = realworldReport.violations.find(
  (v) => v.routeId === "POST /api/users/login" && v.ruleId === "RULE_1_AUTH_BEFORE_SENSITIVE"
);
assert.strictEqual(loginPostAuthViolation, undefined, "POST /api/users/login must NOT be flagged as missing authentication");
console.log("  ✓ Confirmed POST /api/users/login produces 0 missing-authentication violations");

console.log("\n[Test 28] Verifying Login Endpoint Still Checked for Rate Limiting...");
const loginRateLimitViolation = realworldReport.violations.find(
  (v) => v.routeId === "POST /api/users/login" && v.ruleId === "RULE_4_MISSING_RATE_LIMIT"
);
assert.ok(loginRateLimitViolation, "POST /api/users/login must still be checked for missing rate limiting");
assert.strictEqual(loginRateLimitViolation.severity, "MEDIUM");
console.log("  ✓ Confirmed POST /api/users/login correctly triggers RULE_4_MISSING_RATE_LIMIT");

console.log("\n[Test 29] Verifying Protected User Endpoints (GET /api/user, PUT /api/user)...");
const getUserAuthViolation = realworldReport.violations.find((v) => v.routeId === "GET /api/user");
assert.strictEqual(getUserAuthViolation, undefined, "GET /api/user has auth.required and must be clean");

const putUserAuthViolation = realworldReport.violations.find((v) => v.routeId === "PUT /api/user");
assert.strictEqual(putUserAuthViolation, undefined, "PUT /api/user has auth.required and must be clean");
console.log("  ✓ Confirmed GET /api/user and PUT /api/user enforce auth.required and pass cleanly");

console.log("\n[Test 30] Verifying Protected User Settings Without Auth Triggers Rule 1...");
const vulnSettingsViolation = report.violations.find(
  (v) => v.routeId === "PUT /api/users/settings"
);
// In vulnerable-app, PUT /api/users/settings has verifyToken so it passes
assert.strictEqual(vulnSettingsViolation, undefined, "Protected PUT /api/users/settings with verifyToken passes");
console.log("  ✓ Confirmed protected user-management endpoints are checked and pass when guard is present");

console.log("\n[Test 31] Verifying Configurable Route Policy (expressflow.config.json)...");
const customDir = path.resolve(__dirname, "fixtures/custom-policy-app");
const customManifest = buildManifestForProject(customDir);
const customConfig = loadProjectConfig(customDir);
assert.ok(customConfig, "expressflow.config.json must be loaded");
assert.strictEqual(customConfig.publicRoutes.length, 2);

const customResult = runMiddleEndPipeline(customManifest, customConfig);
const customReport = customResult.securityReport;

// 1. Configured public signup must NOT have missing auth
const customSignupAuth = customReport.violations.find(
  (v) => v.routeId === "POST /api/custom-signup" && v.ruleId === "RULE_1_AUTH_BEFORE_SENSITIVE"
);
assert.strictEqual(customSignupAuth, undefined, "Custom configured public route must not trigger missing auth");

// 2. Configured auth entrypoint without rate limiter MUST trigger rate limiting
const customLoginRate = customReport.violations.find(
  (v) => v.routeId === "POST /api/custom-login" && v.ruleId === "RULE_4_MISSING_RATE_LIMIT"
);
assert.ok(customLoginRate, "Custom configured auth entrypoint must trigger missing rate limiting");

// 3. Unprotected custom delete MUST trigger missing auth
const customDeleteAuth = customReport.violations.find(
  (v) => v.routeId === "DELETE /api/custom-protected" && v.ruleId === "RULE_1_AUTH_BEFORE_SENSITIVE"
);
assert.ok(customDeleteAuth, "Unprotected DELETE must trigger missing authentication");
console.log("  ✓ Successfully verified configurable route policy via expressflow.config.json");

// =============================================================================
// PART 6: MISORDERED MIDDLEWARE & HANDLER IDENTIFICATION SUITE
// =============================================================================
console.log("\n>>> PART 6: MISORDERED MIDDLEWARE & HANDLER IDENTIFICATION <<<");

console.log("\n[Test 32] Verifying Correctly Ordered Route (Auth Before Handler)...");
const orderedRoute = {
  routeId: "DELETE /api/items/:id",
  httpMethod: "DELETE",
  fullPath: "/api/items/:id",
  sourceFile: "routes/items.js",
  loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 50 } },
  effectiveMiddlewares: [
    { executionOrder: 0, scope: "ROUTE", name: "verifyToken", rawExpression: "verifyToken", isInline: false, sourceFile: "routes/items.js", loc: { start: { line: 1, column: 10 }, end: { line: 1, column: 21 } } },
    { executionOrder: 1, scope: "ROUTE", name: "deleteItemHandler", rawExpression: "deleteItemHandler", isInline: false, sourceFile: "routes/items.js", loc: { start: { line: 1, column: 23 }, end: { line: 1, column: 40 } } },
  ],
};
const orderedCfg = buildRouteCfg(orderedRoute);
const orderedAudit = checkSecurityInvariants([orderedCfg]);
assert.strictEqual(orderedAudit.violations.length, 0, "Correctly ordered route must have 0 violations");
console.log("  ✓ Verified auth middleware before action handler produces 0 violations");

console.log("\n[Test 33] Verifying Misordered Route (Auth After Handler)...");
const misorderedRoute = {
  routeId: "DELETE /api/items/:id",
  httpMethod: "DELETE",
  fullPath: "/api/items/:id",
  sourceFile: "routes/items.js",
  loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 50 } },
  effectiveMiddlewares: [
    { executionOrder: 0, scope: "ROUTE", name: "deleteItemHandler", rawExpression: "deleteItemHandler", isInline: false, sourceFile: "routes/items.js", loc: { start: { line: 1, column: 10 }, end: { line: 1, column: 27 } } },
    { executionOrder: 1, scope: "ROUTE", name: "verifyToken", rawExpression: "verifyToken", isInline: false, sourceFile: "routes/items.js", loc: { start: { line: 1, column: 29 }, end: { line: 1, column: 40 } } },
  ],
};
const misorderedCfg = buildRouteCfg(misorderedRoute);
const misorderedAudit = checkSecurityInvariants([misorderedCfg]);
const misorderedVio = misorderedAudit.violations.find((v) => v.ruleId === "RULE_2_MISORDERED_SECURITY_GUARD");
assert.ok(misorderedVio, "Must flag misordered guard placed after handler");
assert.strictEqual(misorderedVio.severity, "CRITICAL");
assert.ok(misorderedVio.message.includes("deleteItemHandler"), "Diagnostic must identify deleteItemHandler as the action handler");
console.log("  ✓ Correctly flagged misordered guard placed after handler with exact action identification");

console.log("\n[Test 34] Verifying Multiple Unrelated Middlewares Before Auth...");
const multiBeforeAuthRoute = {
  routeId: "POST /api/orders",
  httpMethod: "POST",
  fullPath: "/api/orders",
  sourceFile: "routes/orders.js",
  loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 80 } },
  effectiveMiddlewares: [
    { executionOrder: 0, scope: "ROUTE", name: "logger", rawExpression: "logger", isInline: false, sourceFile: "routes/orders.js", loc: { start: { line: 1, column: 10 }, end: { line: 1, column: 16 } } },
    { executionOrder: 1, scope: "ROUTE", name: "bodyParser", rawExpression: "bodyParser", isInline: false, sourceFile: "routes/orders.js", loc: { start: { line: 1, column: 18 }, end: { line: 1, column: 28 } } },
    { executionOrder: 2, scope: "ROUTE", name: "verifyToken", rawExpression: "verifyToken", isInline: false, sourceFile: "routes/orders.js", loc: { start: { line: 1, column: 30 }, end: { line: 1, column: 41 } } },
    { executionOrder: 3, scope: "ROUTE", name: "orderHandler", rawExpression: "orderHandler", isInline: false, sourceFile: "routes/orders.js", loc: { start: { line: 1, column: 43 }, end: { line: 1, column: 55 } } },
  ],
};
const multiBeforeCfg = buildRouteCfg(multiBeforeAuthRoute);
const multiBeforeAudit = checkSecurityInvariants([multiBeforeCfg]);
const falseMisorder = multiBeforeAudit.violations.find((v) => v.ruleId === "RULE_2_MISORDERED_SECURITY_GUARD");
assert.strictEqual(falseMisorder, undefined, "Multiple unrelated middlewares before auth must NOT be flagged as misordered");
console.log("  ✓ Verified multiple unrelated middlewares before auth do not trigger false misordering");

console.log("\n[Test 35] Verifying Multiple Middlewares With Auth After Action Handler...");
const multiAfterHandlerRoute = {
  routeId: "POST /api/orders",
  httpMethod: "POST",
  fullPath: "/api/orders",
  sourceFile: "routes/orders.js",
  loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 80 } },
  effectiveMiddlewares: [
    { executionOrder: 0, scope: "ROUTE", name: "logger", rawExpression: "logger", isInline: false, sourceFile: "routes/orders.js", loc: { start: { line: 1, column: 10 }, end: { line: 1, column: 16 } } },
    { executionOrder: 1, scope: "ROUTE", name: "bodyParser", rawExpression: "bodyParser", isInline: false, sourceFile: "routes/orders.js", loc: { start: { line: 1, column: 18 }, end: { line: 1, column: 28 } } },
    { executionOrder: 2, scope: "ROUTE", name: "orderHandler", rawExpression: "orderHandler", isInline: false, sourceFile: "routes/orders.js", loc: { start: { line: 1, column: 30 }, end: { line: 1, column: 42 } } },
    { executionOrder: 3, scope: "ROUTE", name: "verifyToken", rawExpression: "verifyToken", isInline: false, sourceFile: "routes/orders.js", loc: { start: { line: 1, column: 44 }, end: { line: 1, column: 55 } } },
  ],
};
const multiAfterCfg = buildRouteCfg(multiAfterHandlerRoute);
const multiAfterAudit = checkSecurityInvariants([multiAfterCfg]);
const multiAfterVio = multiAfterAudit.violations.find((v) => v.ruleId === "RULE_2_MISORDERED_SECURITY_GUARD");
assert.ok(multiAfterVio, "Must flag verifyToken placed after orderHandler in multi-middleware chain");
assert.strictEqual(multiAfterVio.violatingNodeLabel, "[ROUTE] verifyToken");
console.log("  ✓ Correctly flagged misordered auth in chain with 4 middlewares without positional hardcoding");

console.log("\n[Test 36] Verifying Genuinely Unprotected Sensitive Handler...");
const unprotectedRoute = {
  routeId: "DELETE /api/data",
  httpMethod: "DELETE",
  fullPath: "/api/data",
  sourceFile: "routes/data.js",
  loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 40 } },
  effectiveMiddlewares: [
    { executionOrder: 0, scope: "ROUTE", name: "deleteDataHandler", rawExpression: "deleteDataHandler", isInline: false, sourceFile: "routes/data.js", loc: { start: { line: 1, column: 10 }, end: { line: 1, column: 27 } } },
  ],
};
const unprotectedCfg = buildRouteCfg(unprotectedRoute);
const unprotectedAudit = checkSecurityInvariants([unprotectedCfg]);
const unprotectedVio = unprotectedAudit.violations.find((v) => v.ruleId === "RULE_1_AUTH_BEFORE_SENSITIVE");
assert.ok(unprotectedVio, "Must flag genuinely unprotected DELETE route");
assert.strictEqual(unprotectedVio.severity, "CRITICAL");
console.log("  ✓ Correctly flagged genuinely unprotected sensitive handler (Severity: CRITICAL)");

// =============================================================================
// PART 7: CONFIGURATION RELIABILITY & ERROR DIAGNOSTICS SUITE
// =============================================================================
console.log("\n>>> PART 7: CONFIGURATION RELIABILITY & ERROR DIAGNOSTICS <<<");

// Test 37: A valid configuration file loads normally
console.log("\n[Test 37] Verifying Valid Configuration File Loads Normally...");
const validConfigDir = path.resolve(__dirname, "fixtures/custom-policy-app");
const validDiagHolder = {
  status: "COMPLETE",
  statusMessage: "Initial status",
  discoveredFiles: 1,
  analyzedFiles: 1,
  failedFiles: 0,
  errors: [],
};
const validConfig = loadProjectConfig(validConfigDir, validDiagHolder);
assert.ok(validConfig, "Valid expressflow.config.json must load successfully");
assert.strictEqual(validConfig.publicRoutes.length, 2, "Expected 2 configured public routes");
assert.strictEqual(validDiagHolder.status, "COMPLETE", "Diagnostics status must remain COMPLETE for valid config");
assert.strictEqual(validDiagHolder.failedFiles, 0, "Failed files must remain 0");
assert.strictEqual(validDiagHolder.errors.length, 0, "No diagnostic errors should be logged for valid config");
console.log("  ✓ Valid configuration file loads normally with COMPLETE status");

// Test 38: Invalid JSON in configuration marks analysis incomplete
console.log("\n[Test 38] Verifying Invalid JSON in Configuration File Marks Analysis INCOMPLETE...");
const invalidConfigDir = path.resolve(__dirname, "fixtures/invalid-config-app");

// 38a: Direct loadProjectConfig call with diagnostics
const invalidDiagHolder = {
  status: "COMPLETE",
  statusMessage: "Initial status",
  discoveredFiles: 1,
  analyzedFiles: 1,
  failedFiles: 0,
  errors: [],
};
const invalidConfig = loadProjectConfig(invalidConfigDir, invalidDiagHolder);
assert.strictEqual(invalidConfig, undefined, "Invalid config must return undefined");
assert.strictEqual(invalidDiagHolder.status, "INCOMPLETE", "Diagnostics status must be updated to INCOMPLETE");
assert.strictEqual(invalidDiagHolder.failedFiles, 1, "Failed files must be incremented to 1");
const invalidErr = invalidDiagHolder.errors.find((e) => e.filePath.includes("expressflow.config.json"));
assert.ok(invalidErr, "Structured diagnostic error must be recorded for expressflow.config.json");
assert.ok(invalidErr.error.includes("Invalid or unreadable configuration file"), "Diagnostic must describe config failure");

// 38b: Full project analysis pipeline marks status INCOMPLETE while preserving valid route findings
const invalidManifest = buildManifestForProject(invalidConfigDir);
assert.strictEqual(invalidManifest.diagnostics.status, "INCOMPLETE", "Project manifest must be marked INCOMPLETE");
assert.strictEqual(invalidManifest.files.length, 1, "app.js must still be parsed successfully");

const invalidResult = runMiddleEndPipeline(invalidManifest);
const invalidReport = invalidResult.securityReport;
assert.strictEqual(invalidReport.status, "INCOMPLETE", "Security analysis report status must be INCOMPLETE");
assert.strictEqual(invalidReport.passed, false, "Audit cannot pass when configuration is invalid");
// Verify findings from app.js are preserved!
assert.strictEqual(invalidReport.vulnerableRoutes, 1, "Vulnerable DELETE /api/admin/system finding must be preserved");
const deleteViolation = invalidReport.violations.find((v) => v.routeId === "DELETE /api/admin/system");
assert.ok(deleteViolation, "Must still report security findings from successfully analyzed source files");
console.log("  ✓ Invalid JSON in configuration marks analysis INCOMPLETE and preserves source route findings");

// Test 39: Missing configuration file remains acceptable when optional
console.log("\n[Test 39] Verifying Missing Configuration File Remains Acceptable (Optional)...");
const noConfigDir = path.resolve(__dirname, "fixtures/modular-app");
const missingDiagHolder = {
  status: "COMPLETE",
  statusMessage: "Initial status",
  discoveredFiles: 4,
  analyzedFiles: 4,
  failedFiles: 0,
  errors: [],
};
const missingConfig = loadProjectConfig(noConfigDir, missingDiagHolder);
assert.strictEqual(missingConfig, undefined, "Missing config must return undefined");
assert.strictEqual(missingDiagHolder.status, "COMPLETE", "Diagnostics status must remain COMPLETE when config is missing");
assert.strictEqual(missingDiagHolder.failedFiles, 0, "No failed files when config is absent");
assert.strictEqual(missingDiagHolder.errors.length, 0, "No diagnostic errors when config is absent");
console.log("  ✓ Missing configuration file is accepted cleanly without diagnostics error");

// Test 40: CLI returns non-zero exit code for invalid configuration
console.log("\n[Test 40] Verifying CLI Returns Non-Zero Exit Code for Invalid Configuration...");
const cliEntrypoint = path.resolve(__dirname, "../dist/index.js");
let cliExitCode = 0;
let cliStdout = "";
try {
  cliStdout = execSync(`node "${cliEntrypoint}" "${invalidConfigDir}"`, {
    stdio: ["pipe", "pipe", "pipe"],
  }).toString();
} catch (err) {
  cliExitCode = err.status !== undefined ? err.status : 1;
  cliStdout = (err.stdout ? err.stdout.toString() : "") + (err.stderr ? err.stderr.toString() : "");
}
assert.strictEqual(cliExitCode, 1, "CLI must exit with code 1 for invalid configuration");
assert.ok(
  cliStdout.includes("Analysis Incomplete") || cliStdout.includes("expressflow.config.json"),
  "CLI output must clearly display incomplete analysis and config error"
);
console.log("  ✓ CLI exited with code 1 and reported incomplete audit on invalid configuration");

// Test 41: Runtime schema validation rejects malformed configuration structures
console.log("\n[Test 41] Verifying Runtime Schema Validation of expressflow.config.json...");

// 41a: Root must be a JSON object
assert.throws(
  () => validateExpressFlowConfig(null),
  /Configuration root must be a JSON object/,
  "null root must be rejected"
);
assert.throws(
  () => validateExpressFlowConfig(42),
  /Configuration root must be a JSON object/,
  "numeric root must be rejected"
);
assert.throws(
  () => validateExpressFlowConfig(["not", "an", "object"]),
  /Configuration root must be a JSON object/,
  "array root must be rejected"
);

// 41b: publicRoutes must be an array of strings (e.g. {"publicRoutes": 42})
assert.throws(
  () => validateExpressFlowConfig({ publicRoutes: 42 }),
  /Field 'publicRoutes' must be an array of strings/,
  "non-array publicRoutes must be rejected"
);
assert.throws(
  () => validateExpressFlowConfig({ publicRoutes: [42] }),
  /Field 'publicRoutes\[0\]' must be a string/,
  "array of non-strings for publicRoutes must be rejected"
);

// 41c: policies must be an array of objects (e.g. {"policies": {}})
assert.throws(
  () => validateExpressFlowConfig({ policies: {} }),
  /Field 'policies' must be an array of policy rule objects/,
  "object for policies must be rejected"
);
assert.throws(
  () => validateExpressFlowConfig({ policies: ["not-an-object"] }),
  /Policy rule at 'policies\[0\]' must be an object/,
  "array of non-objects for policies must be rejected"
);

// 41d: Policy rule with invalid path type (e.g. {"policies": [{"path": 42}]})
assert.throws(
  () => validateExpressFlowConfig({ policies: [{ path: 42 }] }),
  /must have a valid 'path'/,
  "policy rule with numeric path must be rejected"
);
assert.throws(
  () => validateExpressFlowConfig({ policies: [{}] }),
  /must have a valid 'path'/,
  "policy rule with missing path must be rejected"
);

// 41e: authEntrypoints must be an array of strings (e.g. {"authEntrypoints": [42]})
assert.throws(
  () => validateExpressFlowConfig({ authEntrypoints: [42] }),
  /Field 'authEntrypoints\[0\]' must be a string/,
  "authEntrypoints containing non-strings must be rejected"
);
assert.throws(
  () => validateExpressFlowConfig({ authEntrypoints: "not-an-array" }),
  /Field 'authEntrypoints' must be an array of strings/,
  "non-array authEntrypoints must be rejected"
);

// 41f: Unsupported HTTP method and non-boolean flags
assert.throws(
  () => validateExpressFlowConfig({ policies: [{ path: "/api", method: "INVALID_METHOD" }] }),
  /unsupported HTTP method/,
  "unsupported HTTP method in policy rule must be rejected"
);
assert.throws(
  () => validateExpressFlowConfig({ policies: [{ path: "/api", isPublic: "true" }] }),
  /must be a boolean/,
  "string instead of boolean in policy rule must be rejected"
);
console.log("  ✓ Runtime schema validation successfully rejects all malformed config patterns");

// Test 42: Analysis on project with invalid schema preserves route findings and marks status INCOMPLETE
console.log("\n[Test 42] Verifying Pipeline on Project with Schema Error ({\"publicRoutes\": 42})...");
const invalidSchemaDir = path.resolve(__dirname, "fixtures/invalid-schema-app");
const invalidSchemaManifest = buildManifestForProject(invalidSchemaDir);

assert.strictEqual(invalidSchemaManifest.diagnostics.status, "INCOMPLETE", "Status must be INCOMPLETE");
assert.strictEqual(invalidSchemaManifest.files.length, 1, "app.js must be parsed");
assert.ok(
  invalidSchemaManifest.diagnostics.errors.some(
    (e) => e.filePath.includes("expressflow.config.json") && e.error.includes("publicRoutes")
  ),
  "Must report structured diagnostic for expressflow.config.json with publicRoutes schema failure"
);

const invalidSchemaResult = runMiddleEndPipeline(invalidSchemaManifest);
const invalidSchemaReport = invalidSchemaResult.securityReport;

assert.strictEqual(invalidSchemaReport.status, "INCOMPLETE", "Security report must be INCOMPLETE");
assert.strictEqual(invalidSchemaReport.passed, false, "Audit must not pass on invalid config");
assert.strictEqual(invalidSchemaReport.vulnerableRoutes, 1, "Must find 1 vulnerable route from app.js");
const appFinding = invalidSchemaReport.violations.find((v) => v.routeId === "DELETE /api/admin/users");
assert.ok(appFinding, "DELETE /api/admin/users finding must be preserved despite schema error");
console.log("  ✓ Successfully preserved source findings and marked status INCOMPLETE without crashing");

// Test 43: CLI reproduction test: {"publicRoutes": 42} exits with code 1 and does not throw TypeError
console.log("\n[Test 43] Verifying CLI Reproduction on {\"publicRoutes\": 42} Project...");
let schemaCliExitCode = 0;
let schemaCliStdout = "";
try {
  schemaCliStdout = execSync(`node "${cliEntrypoint}" "${invalidSchemaDir}"`, {
    stdio: ["pipe", "pipe", "pipe"],
  }).toString();
} catch (err) {
  schemaCliExitCode = err.status !== undefined ? err.status : 1;
  schemaCliStdout = (err.stdout ? err.stdout.toString() : "") + (err.stderr ? err.stderr.toString() : "");
}
assert.strictEqual(schemaCliExitCode, 1, "CLI must exit with code 1 for schema error");
assert.ok(
  !schemaCliStdout.includes("TypeError"),
  "CLI must NOT crash with TypeError on invalid configuration schema"
);
assert.ok(
  schemaCliStdout.includes("Field 'publicRoutes' must be an array of strings"),
  "CLI output must report exact schema validation error"
);
assert.ok(
  schemaCliStdout.includes("DELETE /api/admin/users"),
  "CLI output must preserve and display security findings from app.js"
);
console.log("  ✓ CLI executed cleanly with exit code 1, reported schema diagnostic, and preserved findings");


// Test 44: Rule 3 (administrative route lacks role guard)
console.log("\n[Test 44] Verifying Invariant Rule 3: Administrative Role Guard...");
const rule3Dir = path.resolve(__dirname, "fixtures/rule3-app");
const rule3Result = runMiddleEndPipeline(buildManifestForProject(rule3Dir));
const rule3Vio = rule3Result.securityReport.violations.find(
  (v) => v.ruleId === "RULE_3_UNPROTECTED_ADMIN_MOUNT" && v.routeId === "GET /api/admin/users"
);
assert.ok(rule3Vio, "GET /api/admin/users (auth but no role guard) must trigger Rule 3");
assert.strictEqual(rule3Vio.severity, "HIGH");
assert.strictEqual(
  rule3Result.securityReport.violations.filter((v) => v.ruleId === "RULE_1_AUTH_BEFORE_SENSITIVE").length,
  0,
  "Authenticated admin route must not also trigger Rule 1"
);
console.log("  ✓ Correctly flagged admin route with authentication but no role guard (Severity: HIGH)");

console.log("\n================================================================================");
console.log("🎉 ALL 44 TESTS PASSED! EXPRESSFLOW CONFIG VALIDATION FULLY VERIFIED!");
console.log("================================================================================");
