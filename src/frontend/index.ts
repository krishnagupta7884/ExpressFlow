/**
 * ExpressFlow Frontend Pipeline
 * Lead: Krishna
 */

export * from "../shared/types/manifest";
export { parseSourceCode } from "./parser/astParser";
export { discoverSourceFiles, readSourceFile } from "./parser/fileLoader";
export { trackExpressSymbols, SymbolTable } from "./scope/symbolTracker";
export { extractRoutesAndMounts, RouteExtractionResult } from "./visitor/routeVisitor";
export {
  extractRoutePath,
  extractMiddlewareMetadata,
  flattenMiddlewareNodes,
} from "./visitor/argumentExtractor";
export { trackExports } from "./visitor/exportTracker";
export { trackImports } from "./visitor/importTracker";
export {
  analyzeSourceContent,
  buildManifestForProject,
} from "./serializer/manifestBuilder";
