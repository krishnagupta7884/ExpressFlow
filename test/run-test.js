const assert = require("node:assert");
const path = require("node:path");
const {
  readSourceFile,
  analyzeSourceContent,
  buildManifestForProject,
  runMiddleEndPipeline,
  toAscii,
  toDot,
  toMermaid,
} = require("../dist/index.js");

console.log("=================================================");
console.log("EXPRESSFLOW AUTOMATED TEST SUITE (REVIEW 2 - 75%)");
console.log("=================================================");

// =============================================================================
// PART 1: FRONTEND PIPELINE TESTS
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
// PART 2: MIDDLE-END ENGINE TESTS
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

console.log("\n=================================================");
console.log("🎉 ALL TESTS PASSED! 75% IMPLEMENTATION IS READY!");
console.log("=================================================");
