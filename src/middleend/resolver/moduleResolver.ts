import * as path from "path";
import {
  ExpressFlowManifest,
  HttpMethod,
  MiddlewareMetadata,
  MountRegistration,
  RouteRegistration,
  RouterDeclaration,
  RouterKind,
  SourceFileMetadata,
  SourceLocation,
} from "../../shared/types/manifest";

export interface ResolvedMount {
  parentRouterId: string;
  subRouterIdentifier: string;
  targetRouterId: string | null; // Resolved Router ID, e.g. "routes/users.js::userRouter"
  mountPath: string;             // e.g. "/api/users"
  loc: SourceLocation;
}

export interface ResolvedRouter {
  id: string;                    // Unique router ID: `${filePath}::${identifier}`
  filePath: string;
  identifier: string;
  kind: RouterKind;              // "APPLICATION" | "ROUTER"
  routeRegistrations: RouteRegistration[];
  mounts: ResolvedMount[];
  loc: SourceLocation;
}

export interface ProjectResolutionContext {
  manifest: ExpressFlowManifest;
  routers: Map<string, ResolvedRouter>;          // routerId -> ResolvedRouter
  routersByFile: Map<string, ResolvedRouter[]>;  // normalizedFilePath -> ResolvedRouter[]
  rootApplications: ResolvedRouter[];            // Entry-point Express apps
  standaloneRouters: ResolvedRouter[];           // Routers not mounted anywhere
  unresolvedMounts: ResolvedMount[];
}

/**
 * Normalizes relative file paths to standard POSIX style without leading './'.
 */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Attempts to resolve a module import specifier (e.g. './routes/users') to a known file in the manifest.
 */
export function resolveModulePath(
  currentFile: string,
  importSource: string,
  knownFiles: Set<string>
): string | null {
  if (!importSource.startsWith(".")) {
    return null; // External package like 'express' or 'cors'
  }

  const currentDir = path.dirname(currentFile);
  const candidateBase = normalizePath(path.join(currentDir, importSource));

  const extensions = ["", ".js", ".ts", ".jsx", ".tsx", "/index.js", "/index.ts"];

  for (const ext of extensions) {
    const candidate = normalizePath(candidateBase + ext);
    if (knownFiles.has(candidate)) {
      return candidate;
    }
  }

  // Fallback: match by filename
  const baseName = path.basename(importSource, path.extname(importSource));
  for (const file of knownFiles) {
    const fileBase = path.basename(file, path.extname(file));
    if (fileBase === baseName) {
      return file;
    }
  }

  return null;
}

/**
 * Ingests an ExpressFlow Intermediate Representation (IR) Manifest and resolves
 * cross-file router imports, exports, and mounts into a connected symbol graph.
 */
export function resolveModules(manifest: ExpressFlowManifest): ProjectResolutionContext {
  const routers = new Map<string, ResolvedRouter>();
  const routersByFile = new Map<string, ResolvedRouter[]>();
  const knownFiles = new Set<string>();

  // Map: normalizedFilePath -> (localId -> { source, importedName })
  const importsMap = new Map<string, Map<string, { source: string; importedName?: string }>>();

  // Map: normalizedFilePath -> { defaultExportLocalId?: string, namedExports: Map<exportName, localId> }
  const exportsMap = new Map<
    string,
    { defaultExportLocalId?: string; namedExports: Map<string, string> }
  >();

  // Pass 1: Index files, routers, imports, and exports
  for (const file of manifest.files) {
    const normPath = normalizePath(file.filePath);
    knownFiles.add(normPath);

    // Track exports
    const namedExports = new Map<string, string>();
    let defaultExportLocalId: string | undefined;

    for (const exp of file.exports) {
      if (exp.type === "DEFAULT") {
        defaultExportLocalId = exp.localIdentifier;
      } else if (exp.exportName) {
        namedExports.set(exp.exportName, exp.localIdentifier);
      }
    }
    exportsMap.set(normPath, { defaultExportLocalId, namedExports });

    // Track imports
    const fileImports = new Map<string, { source: string; importedName?: string }>();
    if (file.imports) {
      for (const imp of file.imports) {
        fileImports.set(imp.localIdentifier, {
          source: imp.source,
          importedName: imp.importedName,
        });
      }
    }
    importsMap.set(normPath, fileImports);

    // Track routers declared in this file
    const fileRouters: ResolvedRouter[] = [];
    for (const rDecl of file.routersDeclared) {
      const routerId = `${normPath}::${rDecl.identifier}`;
      const resolvedRouter: ResolvedRouter = {
        id: routerId,
        filePath: normPath,
        identifier: rDecl.identifier,
        kind: rDecl.kind,
        routeRegistrations: file.routeRegistrations.filter(
          (r) => r.routerIdentifier === rDecl.identifier
        ),
        mounts: [],
        loc: rDecl.loc,
      };

      routers.set(routerId, resolvedRouter);
      fileRouters.push(resolvedRouter);
    }

    routersByFile.set(normPath, fileRouters);
  }

  // Pass 2: Resolve sub-router mounts (both local and cross-file)
  const mountedRouterIds = new Set<string>();
  const unresolvedMounts: ResolvedMount[] = [];

  for (const file of manifest.files) {
    const normPath = normalizePath(file.filePath);
    const fileImports = importsMap.get(normPath) || new Map();

    for (const mount of file.mounts) {
      const parentRouterId = `${normPath}::${mount.parentRouter}`;
      const parentRouter = routers.get(parentRouterId);

      let targetRouterId: string | null = null;

      // 1. Check local router in the same file
      const localCandidateId = `${normPath}::${mount.subRouterIdentifier}`;
      if (routers.has(localCandidateId)) {
        targetRouterId = localCandidateId;
      }

      // 2. Check if subRouterIdentifier was imported from another file
      if (!targetRouterId && fileImports.has(mount.subRouterIdentifier)) {
        const importInfo = fileImports.get(mount.subRouterIdentifier)!;
        const targetFile = resolveModulePath(normPath, importInfo.source, knownFiles);

        if (targetFile) {
          const targetExports = exportsMap.get(targetFile);
          const targetRouters = routersByFile.get(targetFile) || [];

          // Match default export
          if (targetExports?.defaultExportLocalId) {
            const expId = `${targetFile}::${targetExports.defaultExportLocalId}`;
            if (routers.has(expId)) {
              targetRouterId = expId;
            }
          }

          // Match named export
          if (!targetRouterId && importInfo.importedName && targetExports?.namedExports.has(importInfo.importedName)) {
            const localName = targetExports.namedExports.get(importInfo.importedName)!;
            const expId = `${targetFile}::${localName}`;
            if (routers.has(expId)) {
              targetRouterId = expId;
            }
          }

          // Fallback: pick the first router in that target file
          if (!targetRouterId && targetRouters.length > 0) {
            targetRouterId = targetRouters[0].id;
          }
        }
      }

      // 3. Heuristic resolution: look for any declared router with matching identifier across files
      if (!targetRouterId) {
        for (const [rId, rObj] of routers) {
          if (rObj.identifier === mount.subRouterIdentifier) {
            targetRouterId = rId;
            break;
          }
        }
      }

      // 4. File-name heuristic: e.g. userRouter matches 'routes/user.js'
      if (!targetRouterId) {
        const cleanedName = mount.subRouterIdentifier.toLowerCase().replace(/router|routes/g, "");
        for (const [rId, rObj] of routers) {
          const fileBase = path.basename(rObj.filePath, path.extname(rObj.filePath)).toLowerCase();
          if (fileBase.includes(cleanedName) && cleanedName.length > 1) {
            targetRouterId = rId;
            break;
          }
        }
      }

      const resolvedMount: ResolvedMount = {
        parentRouterId,
        subRouterIdentifier: mount.subRouterIdentifier,
        targetRouterId,
        mountPath: mount.path.value || "/",
        loc: mount.loc,
      };

      if (targetRouterId) {
        mountedRouterIds.add(targetRouterId);
      } else {
        unresolvedMounts.push(resolvedMount);
      }

      if (parentRouter) {
        parentRouter.mounts.push(resolvedMount);
      }
    }
  }

  // Pass 3: Classify root applications and standalone routers
  const rootApplications: ResolvedRouter[] = [];
  const standaloneRouters: ResolvedRouter[] = [];

  for (const [rId, rObj] of routers) {
    if (rObj.kind === "APPLICATION") {
      rootApplications.push(rObj);
    } else if (!mountedRouterIds.has(rId)) {
      standaloneRouters.push(rObj);
    }
  }

  // If no explicit application found, treat standalone routers as root entry points
  if (rootApplications.length === 0 && standaloneRouters.length > 0) {
    rootApplications.push(...standaloneRouters);
  }

  return {
    manifest,
    routers,
    routersByFile,
    rootApplications,
    standaloneRouters,
    unresolvedMounts,
  };
}
