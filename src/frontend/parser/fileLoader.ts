import * as fs from "fs";
import * as path from "path";

/**
 * Recursively finds all JavaScript and TypeScript files in a directory,
 * ignoring common non-source directories like node_modules, .git, and dist.
 */
export function discoverSourceFiles(rootDir: string): string[] {
  const ignoredDirs = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage",
    ".gemini",
  ]);
  const supportedExtensions = new Set([".js", ".ts", ".mjs", ".cjs"]);
  const results: string[] = [];

  try {
    const stat = fs.statSync(rootDir);
    if (stat.isFile()) {
      return [rootDir];
    }
  } catch {
    return [];
  }

  function traverseDir(currentDir: string) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (ignoredDirs.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        traverseDir(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (supportedExtensions.has(ext) && !entry.name.endsWith(".d.ts")) {
          results.push(fullPath);
        }
      }
    }
  }

  traverseDir(rootDir);
  return results;
}

/**
 * Reads source code content from a file path safely.
 */
export function readSourceFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}
