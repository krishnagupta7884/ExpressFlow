#!/usr/bin/env node
import * as path from "path";
import * as fs from "fs";
import { buildManifestForProject } from "./frontend/serializer/manifestBuilder";

/**
 * ExpressFlow CLI Entry Point
 */
function main() {
  const args = process.argv.slice(2);
  const targetDir = args[0] || process.cwd();
  const outputPath = args[1];

  console.log(`[ExpressFlow] Analyzing project directory: ${path.resolve(targetDir)}`);

  const manifest = buildManifestForProject(targetDir);

  const jsonString = JSON.stringify(manifest, null, 2);

  if (outputPath) {
    fs.writeFileSync(outputPath, jsonString, "utf-8");
    console.log(`[ExpressFlow] Manifest successfully written to: ${outputPath}`);
  } else {
    console.log("\n--- Generated ExpressFlow IR Manifest ---");
    console.log(jsonString);
  }
}

if (require.main === module) {
  main();
}

export * from "./frontend";
