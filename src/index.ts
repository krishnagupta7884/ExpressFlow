#!/usr/bin/env node
import * as path from "path";
import * as fs from "fs";
import { buildManifestForProject } from "./frontend/serializer/manifestBuilder";
import { runMiddleEndPipeline, toAscii, toDot } from "./middleend";

/**
 * ExpressFlow Unified CLI Entry Point
 * Orchestrates Frontend (Krishna) and Middle-End (Aaditya) Analysis Engines
 */
function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const nonFlagArgs = args.filter((a) => !a.startsWith("--"));

  const targetDir = nonFlagArgs[0] || process.cwd();
  const outputPath = nonFlagArgs[1];

  console.log("================================================================================");
  console.log(" EXPRESSFLOW: AHEAD-OF-TIME STATIC ROUTE & CFG ANALYSIS ENGINE");
  console.log(" Milestone: Review 2 (75% Implementation - Frontend + Middle-End)");
  console.log("================================================================================");
  console.log(`[Phase 1] Frontend: Scanning source files in ${path.resolve(targetDir)}...`);

  const manifest = buildManifestForProject(targetDir);
  console.log(`  ✓ Indexed ${manifest.files.length} source file(s) into Intermediate Representation.`);

  console.log(`\n[Phase 2] Middle-End: Linking modules, composing routes, and constructing CFGs...`);
  const middleEndResult = runMiddleEndPipeline(manifest);

  const { resolution, composedRoutes, cfgs } = middleEndResult;
  console.log(`  ✓ Discovered ${resolution.routers.size} router declaration(s).`);
  console.log(`  ✓ Resolved ${resolution.rootApplications.length} root application entry-point(s).`);
  console.log(`  ✓ Composed ${composedRoutes.length} reachable endpoint route(s).`);
  console.log(`  ✓ Built ${cfgs.length} Control-Flow Graph(s) (CFGs).\n`);

  // Print Route Summary Table
  console.log("--------------------------------------------------------------------------------");
  console.log(" COMPOSED ENDPOINT ROUTES & CONTROL-FLOW GRAPH SUMMARY");
  console.log("--------------------------------------------------------------------------------");
  console.log(
    "METHOD".padEnd(8) +
    "FULL PATH".padEnd(30) +
    "TOTAL NODES".padEnd(14) +
    "HANDLER".padEnd(25) +
    "SOURCE FILE"
  );
  console.log("-".repeat(95));

  for (const cfg of cfgs) {
    const handlerNode = cfg.nodes.find((n) => n.id === cfg.terminalHandlerNodeId);
    const handlerName = handlerNode?.label.replace(/\[.*?\]\s*/, "") || "anonymous";
    console.log(
      cfg.method.padEnd(8) +
      cfg.fullPath.padEnd(30) +
      String(cfg.nodeCount).padEnd(14) +
      handlerName.slice(0, 23).padEnd(25) +
      `${cfg.sourceFile}:${cfg.loc.start.line}`
    );
  }
  console.log("--------------------------------------------------------------------------------\n");

  // If --cfg flag provided, print ASCII flowcharts for all CFGs
  if (flags.has("--cfg") || flags.has("-v") || flags.has("--visualize")) {
    console.log("================================================================================");
    console.log(" VISUAL CONTROL-FLOW GRAPHS (CFGs)");
    console.log("================================================================================\n");
    for (const cfg of cfgs) {
      console.log(toAscii(cfg));
    }
  }

  // If --dot flag provided, print Graphviz DOT representation
  if (flags.has("--dot")) {
    console.log("\n--- Graphviz DOT Graphs ---");
    for (const cfg of cfgs) {
      console.log(toDot(cfg));
    }
  }

  // Save or output IR Manifest
  if (outputPath) {
    const jsonString = JSON.stringify(manifest, null, 2);
    fs.writeFileSync(outputPath, jsonString, "utf-8");
    console.log(`[ExpressFlow] Intermediate Representation (IR) written to: ${outputPath}`);
  } else if (flags.has("--json")) {
    console.log("\n--- ExpressFlow IR Manifest JSON ---");
    console.log(JSON.stringify(manifest, null, 2));
  }
}

if (require.main === module) {
  main();
}

export * from "./frontend";
export * from "./middleend";
