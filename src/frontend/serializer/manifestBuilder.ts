import * as fs from "fs";
import * as path from "path";
import {
  AnalysisDiagnostics,
  AnalysisStatus,
  ExpressFlowManifest,
  FileDiagnostic,
  SourceFileMetadata,
  SourceLocation,
} from "../../shared/types/manifest";
import { parseSourceCode } from "../parser/astParser";
import { discoverSourceFiles, readSourceFile } from "../parser/fileLoader";
import { trackExpressSymbols } from "../scope/symbolTracker";
import { extractRoutesAndMounts } from "../visitor/routeVisitor";
import { trackExports } from "../visitor/exportTracker";
import { trackImports } from "../visitor/importTracker";

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
  const imports = trackImports(ast);

  return {
    filePath,
    routersDeclared: symbolTable.routerDeclarations,
    routeRegistrations,
    mounts,
    exports,
    imports,
  };
}

/**
 * Analyzes an entire project directory and builds the complete ExpressFlow IR Manifest.
 */
export function buildManifestForProject(
  projectRoot: string
): ExpressFlowManifest {
  const absoluteRoot = path.resolve(projectRoot);
  const errors: FileDiagnostic[] = [];
  const fileMetadatas: SourceFileMetadata[] = [];

  // 1. Verify that the project path exists and is accessible
  if (!fs.existsSync(absoluteRoot)) {
    const errorMsg = `Project target path does not exist: ${absoluteRoot}`;
    errors.push({
      filePath: absoluteRoot,
      error: errorMsg,
    });
    return {
      version: "1.0.0",
      analyzedAt: new Date().toISOString(),
      projectRoot: absoluteRoot,
      files: [],
      diagnostics: {
        status: "INCOMPLETE",
        statusMessage: errorMsg,
        discoveredFiles: 0,
        analyzedFiles: 0,
        failedFiles: 1,
        errors,
      },
    };
  }

  let sourceFiles: string[] = [];
  try {
    sourceFiles = discoverSourceFiles(absoluteRoot);
  } catch (err: any) {
    const errorMsg = `Failed to discover source files in ${absoluteRoot}: ${err?.message || String(err)}`;
    errors.push({
      filePath: absoluteRoot,
      error: errorMsg,
    });
    return {
      version: "1.0.0",
      analyzedAt: new Date().toISOString(),
      projectRoot: absoluteRoot,
      files: [],
      diagnostics: {
        status: "INCOMPLETE",
        statusMessage: errorMsg,
        discoveredFiles: 0,
        analyzedFiles: 0,
        failedFiles: 1,
        errors,
      },
    };
  }

  // 2. Handle empty discovery
  if (sourceFiles.length === 0) {
    return {
      version: "1.0.0",
      analyzedAt: new Date().toISOString(),
      projectRoot: absoluteRoot,
      files: [],
      diagnostics: {
        status: "INCONCLUSIVE",
        statusMessage: "No JavaScript or TypeScript source files discovered in target directory.",
        discoveredFiles: 0,
        analyzedFiles: 0,
        failedFiles: 0,
        errors: [],
      },
    };
  }

  // 3. Process each discovered source file safely
  for (const filePath of sourceFiles) {
    const relativePath = path.relative(absoluteRoot, filePath).replace(/\\/g, "/");
    try {
      const code = readSourceFile(filePath);
      const metadata = analyzeSourceContent(code, relativePath);
      fileMetadatas.push(metadata);
    } catch (err: any) {
      let loc: SourceLocation | undefined;
      if (err && typeof err === "object" && err.loc && typeof err.loc.line === "number") {
        loc = {
          start: { line: err.loc.line, column: err.loc.column || 0 },
          end: { line: err.loc.line, column: err.loc.column || 0 },
        };
      }
      errors.push({
        filePath: relativePath,
        error: err?.message || String(err),
        loc,
      });
    }
  }

  // 4. Compute overall completion status
  const discoveredFiles = sourceFiles.length;
  const analyzedFiles = fileMetadatas.length;
  const failedFiles = errors.length;

  let status: AnalysisStatus = "COMPLETE";
  let statusMessage = `Successfully analyzed ${analyzedFiles} of ${discoveredFiles} source file(s).`;

  if (failedFiles > 0) {
    status = "INCOMPLETE";
    statusMessage = `${failedFiles} of ${discoveredFiles} source file(s) failed during analysis. Results are partial.`;
  } else if (analyzedFiles === 0) {
    status = "INCONCLUSIVE";
    statusMessage = "Zero source files were successfully analyzed.";
  }

  return {
    version: "1.0.0",
    analyzedAt: new Date().toISOString(),
    projectRoot: absoluteRoot,
    files: fileMetadatas,
    diagnostics: {
      status,
      statusMessage,
      discoveredFiles,
      analyzedFiles,
      failedFiles,
      errors,
    },
  };
}
