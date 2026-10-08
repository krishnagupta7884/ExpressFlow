import * as assert from "node:assert";
import * as path from "node:path";
import { readSourceFile } from "../src/frontend/parser/fileLoader";
import { analyzeSourceContent, buildManifestForProject } from "../src/frontend/serializer/manifestBuilder";

console.log("=================================================");
console.log("Running ExpressFlow Frontend Pipeline Test Suite");
console.log("=================================================");

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

// Health route
const healthRoute = metadata.routeRegistrations.find(
  (r) => r.httpMethod === "GET" && r.path.value === "/health"
);
assert.ok(healthRoute, "Expected GET /health route to be extracted");
assert.strictEqual(healthRoute.middlewares.length, 1, "Health route should have 1 handler");
assert.strictEqual(healthRoute.middlewares[0].type, "INLINE_FUNCTION");
assert.deepStrictEqual(healthRoute.middlewares[0].params, ["req", "res"]);
console.log("  ✓ Correctly extracted GET /health with inline callback parameters");

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
const manifest = buildManifestForProject(path.join(__dirname, ".."));
assert.strictEqual(manifest.version, "1.0.0");
assert.ok(manifest.files.length > 0, "Manifest should include analyzed files");
console.log(`  ✓ Successfully built manifest across project (${manifest.files.length} source files indexed)`);

console.log("\n=================================================");
console.log("🎉 ALL TESTS PASSED! FRONTEND PIPELINE IS READY!");
console.log("=================================================");
