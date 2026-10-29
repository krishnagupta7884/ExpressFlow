#!/usr/bin/env node
import * as path from "path";
import * as fs from "fs";
import { buildManifestForProject } from "./frontend/serializer/manifestBuilder";
import {
  runMiddleEndPipeline,
  toAscii,
  toDot,
  formatSecurityReport,
  loadProjectConfig,
  ExpressFlowConfig,
} from "./middleend";
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
 * Orchestrates Frontend AST, Middle-End CFG, and Backend Dominator Security Verification
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
  console.log("│ Full Implementation (Frontend AST + Middle-End CFG + Security Verifier)│");
  console.log("└────────────────────────────────────────────────────────────────────────┘");
  console.log(`[Phase 1] 🔎 Frontend AST Parser`);
  const resolvedTarget = path.resolve(targetDir);
  console.log(`  Scanning directory: ${resolvedTarget}`);

  const manifest = buildManifestForProject(targetDir);
  const diag = manifest.diagnostics;

  // Check for optional project configuration (expressflow.config.json)
  const config = loadProjectConfig(targetDir, manifest.diagnostics);
  if (config) {
    console.log(`  [Config] Loaded custom route policy from expressflow.config.json`);
  }

  if (diag.status === "INCOMPLETE") {
    console.log(`  ✖ Analysis Incomplete: ${diag.failedFiles} file(s) failed during analysis (${diag.analyzedFiles} succeeded).`);
    if (diag.errors.length > 0) {
      for (const err of diag.errors) {
        const locStr = err.loc ? `:${err.loc.start.line}:${err.loc.start.column}` : "";
        console.log(`    • ${err.filePath}${locStr} - ${err.error.split("\n")[0]}`);
      }
    }
    console.log("");
  } else if (diag.status === "INCONCLUSIVE") {
    console.log(`  ℹ Notice: ${diag.statusMessage}\n`);
  } else {
    console.log(`  ✔ Successfully indexed ${manifest.files.length} source file(s) into Intermediate Representation.\n`);
  }

  console.log(`[Phase 2] ⚙️  Middle-End CFG Engine`);
  console.log(`  Linking modules, composing URL paths, and constructing Control-Flow Graphs...`);
  const middleEndResult = runMiddleEndPipeline(manifest, config);

  const { resolution, composedRoutes, cfgs, securityReport } = middleEndResult;
  console.log(`  ✔ Discovered ${resolution.routers.size} router declaration(s).`);
  console.log(`  ✔ Resolved ${resolution.rootApplications.length} root application entry-point(s).`);
  console.log(`  ✔ Composed ${composedRoutes.length} reachable endpoint route(s).`);
  console.log(`  ✔ Synthesized ${cfgs.length} formal Control-Flow Graph(s) (CFGs).\n`);

  console.log(`[Phase 3] 🛡️  Backend Security Analysis (Dominator Invariant Verification)`);
  console.log(`  ✔ Computed formal Dominator Trees for all ${cfgs.length} route graph(s).`);
  console.log(`  ✔ Evaluated invariant dominance: Auth-Before-Sensitive, Invariant Ordering, Rate Limiting.`);

  if (securityReport.status === "INCOMPLETE") {
    console.log(`  ✖ Security Audit Status: INCOMPLETE (${diag.failedFiles} file(s) failed) | ${securityReport.vulnerableRoutes} Vulnerable in parsed files\n`);
  } else if (securityReport.status === "INCONCLUSIVE") {
    console.log(`  ℹ Security Audit Status: INCONCLUSIVE (0 route CFGs evaluated)\n`);
  } else {
    console.log(`  ✔ Security Audit Status: ${securityReport.cleanRoutes} No rule triggered | ${securityReport.vulnerableRoutes} Vulnerable\n`);
  }

  // Print Route Summary Table if routes exist
  if (cfgs.length > 0) {
    console.log("╭────────────────────────────────────────────────────────────────────────╮");
    console.log("│ 📋 COMPOSED ENDPOINT ROUTES & EXECUTION SUMMARY                        │");
    console.log("╰────────────────────────────────────────────────────────────────────────╯");
    console.log(renderRouteTable(cfgs));
    console.log("");
  }

  // If --cfg flag provided, print ASCII flowcharts for all CFGs
  if (flags.has("--cfg") || flags.has("-v") || flags.has("--visualize")) {
    if (cfgs.length > 0) {
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
  }

  // Print Diagnostic Security Report
  console.log(formatSecurityReport(securityReport));

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
    const fullJson = {
      manifest,
      composedRoutes,
      securityReport,
    };
    console.log("\n--- ExpressFlow Full Analysis JSON ---");
    console.log(JSON.stringify(fullJson, null, 2));
  }

  // CLI Exit Code Invariants:
  // 1. Incomplete analysis always exits with a non-zero exit code (cannot certify safety on broken inputs)
  if (securityReport.status === "INCOMPLETE") {
    process.exit(1);
  }

  // 2. Strict mode: exits with non-zero exit code if audit did not cleanly pass
  if (flags.has("--strict") && !securityReport.passed) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export * from "./frontend";
export * from "./middleend";
