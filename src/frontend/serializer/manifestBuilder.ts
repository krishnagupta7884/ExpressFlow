import * as path from "path";
import {
  ExpressFlowManifest,
  SourceFileMetadata,
} from "../../shared/types/manifest";
import { parseSourceCode } from "../parser/astParser";
import { discoverSourceFiles, readSourceFile } from "../parser/fileLoader";
import { trackExpressSymbols } from "../scope/symbolTracker";
import { extractRoutesAndMounts } from "../visitor/routeVisitor";
import { trackExports } from "../visitor/exportTracker";

/**
 * Analyzes a single JavaScript or TypeScript source code string and extracts metadata.
 */
export function analyzeSourceContent(
  code: string,
  filePath: string = "virtual-file.js"
): SourceFileMetadata {
  const ast = parseSourceCode(code);
  const symbolTable = trackExpressSymbols(ast);
  const { routeRegistrations, mounts } = extractRoutesAndMounts(ast, symbolTable);
  const exports = trackExports(ast);

  return {
    filePath,
    routersDeclared: symbolTable.routerDeclarations,
    routeRegistrations,
    mounts,
    exports,
  };
}

/**
 * Analyzes an entire project directory and builds the complete ExpressFlow IR Manifest.
 */
export function buildManifestForProject(
  projectRoot: string
): ExpressFlowManifest {
  const absoluteRoot = path.resolve(projectRoot);
  const sourceFiles = discoverSourceFiles(absoluteRoot);
  const fileMetadatas: SourceFileMetadata[] = [];

  for (const filePath of sourceFiles) {
    try {
      const code = readSourceFile(filePath);
      const relativePath = path.relative(absoluteRoot, filePath).replace(/\\/g, "/");
      const metadata = analyzeSourceContent(code, relativePath);
      fileMetadatas.push(metadata);
    } catch (err) {
      console.warn(`[ExpressFlow Parser] Warning: Failed to parse ${filePath}:`, err);
    }
  }

  return {
    version: "1.0.0",
    analyzedAt: new Date().toISOString(),
    projectRoot: absoluteRoot,
    files: fileMetadatas,
  };
}
