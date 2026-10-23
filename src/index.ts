#!/usr/bin/env node
import * as path from "path";
import * as fs from "fs";
import { buildManifestForProject } from "./frontend/serializer/manifestBuilder";
import { runMiddleEndPipeline, toAscii, toDot } from "./middleend";
import { RouteCfg } from "./middleend/cfg/cfgModel";

/**
 * Formats a clean Unicode box-drawing table for composed routes.
 */
function renderRouteTable(cfgs: RouteCfg[]): string {
  const colWidths = [6, 21, 5, 16, 18];
  const headers = ["METHOD", "COMPOSED ENDPOINT", "STEPS", "ACTION HANDLER", "LOCATION"];

  const top    = "┌─" + colWidths.map(w => "─".repeat(w)).join("─┬─") + "─┐";
  const header = "│ " + headers.map((h, i) => h.padEnd(colWidths[i])).join(" │ ") + " │";
  const sep    = "├─" + colWidths.map(w => "─".repeat(w)).join("─┼─") + "─┤";
  const bottom = "└─" + colWidths.map(w => "─".repeat(w)).join("─┴─") + "─┘";

  const rows = cfgs.map(cfg => {
    const handlerNode = cfg.nodes.find((n) => n.id === cfg.terminalHandlerNodeId);
    const handlerName = handlerNode?.label.replace(/\[.*?\]\s*/, "") || "anonymous";
    const loc = `${cfg.sourceFile}:${cfg.loc.start.line}`;
    return "│ " + [
      cfg.method.slice(0, colWidths[0]).padEnd(colWidths[0]),
      cfg.fullPath.slice(0, colWidths[1]).padEnd(colWidths[1]),
      String(cfg.nodeCount).padEnd(colWidths[2]),
      handlerName.slice(0, colWidths[3]).padEnd(colWidths[3]),
      loc.slice(0, colWidths[4]).padEnd(colWidths[4])
    ].join(" │ ") + " │";
  });

  return [top, header, sep, ...rows, bottom].join("\n");
}

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

  console.log("");
  console.log("┌────────────────────────────────────────────────────────────────────────┐");
  console.log("│ 🚀 EXPRESSFLOW: AHEAD-OF-TIME STATIC ROUTE & CFG COMPILER ENGINE       │");
  console.log("│ Review 2 Milestone: 75% Implementation (Frontend AST + Middle-End CFG) │");
  console.log("└────────────────────────────────────────────────────────────────────────┘");
  console.log(`[Phase 1] 🔎 Frontend AST Parser (Krishna)`);
  console.log(`  Scanning directory: ${path.resolve(targetDir)}`);

  const manifest = buildManifestForProject(targetDir);
  console.log(`  ✔ Successfully indexed ${manifest.files.length} source file(s) into Intermediate Representation.\n`);

  console.log(`[Phase 2] ⚙️  Middle-End CFG Engine (Aaditya)`);
  console.log(`  Linking modules, composing URL paths, and constructing Control-Flow Graphs...`);
  const middleEndResult = runMiddleEndPipeline(manifest);

  const { resolution, composedRoutes, cfgs } = middleEndResult;
  console.log(`  ✔ Discovered ${resolution.routers.size} router declaration(s).`);
  console.log(`  ✔ Resolved ${resolution.rootApplications.length} root application entry-point(s).`);
  console.log(`  ✔ Composed ${composedRoutes.length} reachable endpoint route(s).`);
  console.log(`  ✔ Synthesized ${cfgs.length} formal Control-Flow Graph(s) (CFGs).\n`);

  // Print Route Summary Table
  console.log("╭────────────────────────────────────────────────────────────────────────╮");
  console.log("│ 📋 COMPOSED ENDPOINT ROUTES & EXECUTION SUMMARY                        │");
  console.log("╰────────────────────────────────────────────────────────────────────────╯");
  console.log(renderRouteTable(cfgs));
  console.log("");

  // If --cfg flag provided, print ASCII flowcharts for all CFGs
  if (flags.has("--cfg") || flags.has("-v") || flags.has("--visualize")) {
    console.log("================================================================================");
    console.log(" 📊 VISUAL CONTROL-FLOW GRAPHS (CFGs) - STEP-BY-STEP EXECUTION FLOW");
    console.log("================================================================================");
    console.log(" LEGEND / GUIDE:");
    console.log("   [START] = Incoming HTTP request arrives at server");
    console.log("   [GLOBAL]= Global application middleware (e.g. JSON parser, CORS)");
    console.log("   [ROUTE] = Route-specific guard or authentication check");
    console.log("   [ACTN]  = Controller handler (the final business logic or DB action)");
    console.log("   [END]   = HTTP Response dispatched back to client");
    console.log("   next()  = Middleware calls next() to pass control down the chain");
    console.log("================================================================================\n");

    for (let i = 0; i < cfgs.length; i++) {
      const cfg = cfgs[i];
      console.log(`Route [${i + 1} of ${cfgs.length}]:`);
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
