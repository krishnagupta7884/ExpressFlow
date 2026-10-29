const assert = require("node:assert");
const path = require("node:path");
const {
  buildManifestForProject,
  runMiddleEndPipeline,
  toAscii,
  toDot,
  toMermaid,
} = require("../dist/index.js");

console.log("=================================================");
console.log("Running ExpressFlow Middle-End Pipeline Test Suite");
console.log("=================================================");

// -----------------------------------------------------------------------------
// Test Suite 1: Single-File Fixture (sample-app.js)
// -----------------------------------------------------------------------------
console.log("\n[Test 1] Running Middle-End on Single-File Fixture (sample-app)...");
const sampleAppManifest = buildManifestForProject(path.join(__dirname, "fixtures", "sample-app.js"));
const sampleResult = runMiddleEndPipeline(sampleAppManifest);

// 1. Verify Module Resolution
console.log("\n[Test 2] Verifying Router Resolution in sample-app...");
assert.strictEqual(sampleResult.resolution.rootApplications.length, 1);
assert.strictEqual(sampleResult.resolution.rootApplications[0].identifier, "app");
console.log("  ✓ Correctly resolved root application 'app'");

// 2. Verify Composed Routes
console.log("\n[Test 3] Verifying Route Hierarchy & Prefix Composition in sample-app...");
const checkoutRoute = sampleResult.composedRoutes.find((r) => r.id === "POST /checkout");
assert.ok(checkoutRoute, "Expected POST /checkout to be composed");
// In sample-app.js: global express.json() + rateLimit + verifyToken + validateCart + checkoutHandler = 5 middlewares!
assert.strictEqual(checkoutRoute.effectiveMiddlewares.length, 5);
assert.strictEqual(checkoutRoute.effectiveMiddlewares[0].name, "express.json");
assert.strictEqual(checkoutRoute.effectiveMiddlewares[0].scope, "GLOBAL");
assert.strictEqual(checkoutRoute.effectiveMiddlewares[4].name, "checkoutHandler");
console.log("  ✓ Correctly inherited global middleware into POST /checkout (5 total middlewares)");

const subRouterDeleteRoute = sampleResult.composedRoutes.find((r) => r.id === "DELETE /api/users/:id");
assert.ok(subRouterDeleteRoute, "Expected composed path DELETE /api/users/:id");
assert.strictEqual(subRouterDeleteRoute.fullPath, "/api/users/:id");
console.log("  ✓ Correctly composed cumulative mount path: '/api/users' + '/:id' -> '/api/users/:id'");

// 3. Verify CFG Construction
console.log("\n[Test 4] Verifying Control-Flow Graph (CFG) Construction...");
const checkoutCfg = sampleResult.cfgs.find((c) => c.routeId === "POST /checkout");
assert.ok(checkoutCfg, "Expected CFG for POST /checkout");
assert.strictEqual(checkoutCfg.entryNodeId, "ENTRY");
assert.strictEqual(checkoutCfg.exitNodeId, "EXIT");
assert.strictEqual(checkoutCfg.terminalHandlerNodeId, "HANDLER");
// ENTRY + 5 middlewares (including handler) + EXIT = 7 nodes, 6 sequential edges
assert.strictEqual(checkoutCfg.nodeCount, 7);
assert.strictEqual(checkoutCfg.edgeCount, 6);

// Verify edge connectivity
for (let i = 0; i < checkoutCfg.nodes.length - 1; i++) {
  const current = checkoutCfg.nodes[i];
  const next = checkoutCfg.nodes[i + 1];
  assert.ok(current.successors.includes(next.id), `Expected edge from ${current.id} to ${next.id}`);
  assert.ok(next.predecessors.includes(current.id), `Expected predecessor ${current.id} on ${next.id}`);
}
console.log("  ✓ Validated unbroken sequential edge topology (ENTRY -> M0 -> M1 -> M2 -> M3 -> HANDLER -> EXIT)");

// -----------------------------------------------------------------------------
// Test Suite 2: Multi-File Modular Fixture (modular-app/)
// -----------------------------------------------------------------------------
console.log("\n[Test 5] Running Middle-End on Cross-File Modular Project (modular-app)...");
const modularAppPath = path.join(__dirname, "fixtures", "modular-app");
const modularManifest = buildManifestForProject(modularAppPath);
const modularResult = runMiddleEndPipeline(modularManifest);

assert.strictEqual(modularResult.resolution.rootApplications.length, 1);
assert.strictEqual(modularResult.resolution.routers.size, 3, "Expected 3 routers across modular-app");
console.log(`  ✓ Successfully indexed ${modularResult.resolution.routers.size} routers across files`);

// Verify Cross-File Path Composition
console.log("\n[Test 6] Verifying Cross-File Mount Linking & Prefix Tree...");
const adminDeleteRoute = modularResult.composedRoutes.find((r) => r.id === "DELETE /api/admin/database");
assert.ok(adminDeleteRoute, "Expected composed route DELETE /api/admin/database from routes/admin.js");
assert.strictEqual(adminDeleteRoute.fullPath, "/api/admin/database");

const userProfileRoute = modularResult.composedRoutes.find((r) => r.id === "GET /api/users/profile");
assert.ok(userProfileRoute, "Expected composed route GET /api/users/profile from routes/user.js");
assert.strictEqual(userProfileRoute.fullPath, "/api/users/profile");
console.log("  ✓ Correctly linked cross-file routers: /api/admin/database & /api/users/profile");

// 4. Verify Visualizers (ASCII, DOT, Mermaid)
console.log("\n[Test 7] Verifying CFG Visualizers (ASCII, DOT, Mermaid)...");
const asciiOutput = toAscii(checkoutCfg);
assert.ok(asciiOutput.includes("CFG: POST /checkout"));
assert.ok(asciiOutput.includes("[START]"));
assert.ok(asciiOutput.includes("[ACTN]"));
assert.ok(asciiOutput.includes("[END]"));

const dotOutput = toDot(checkoutCfg);
assert.ok(dotOutput.includes("digraph CFG_POST__checkout"));

const mermaidOutput = toMermaid(checkoutCfg);
assert.ok(mermaidOutput.includes("flowchart TD"));
console.log("  ✓ Generated valid ASCII, Graphviz DOT, and Mermaid diagrams");

console.log("\n=================================================");
console.log("🎉 ALL MIDDLE-END TESTS PASSED (75% MILESTONE REACHED)!");
console.log("=================================================");
