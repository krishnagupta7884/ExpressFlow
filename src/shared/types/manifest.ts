/**
 * ExpressFlow Shared Intermediate Representation (IR) Manifest Contract
 *
 * This contract serves as the shared data boundary between:
 * - Frontend Pipeline (Krishna): Produces this manifest from source AST analysis.
 * - Middle-End Engine (Aaditya): Consumes this manifest to construct CFGs and verify security invariants.
 */

export interface SourceLocation {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
}

export type RouterKind = "APPLICATION" | "ROUTER";

export interface RouterDeclaration {
  identifier: string;
  kind: RouterKind; // "APPLICATION" (express()) vs "ROUTER" (express.Router())
  loc: SourceLocation;
}

export type PathType = "STATIC" | "TEMPLATE" | "DYNAMIC";

export interface RoutePath {
  type: PathType;
  value: string; // Normalized string value (e.g. "/api/users")
  raw: string;   // Exact code representation (e.g. "'/api/users'")
  loc: SourceLocation;
}

export type MiddlewareType =
  | "IDENTIFIER"          // e.g. verifyToken
  | "MEMBER_EXPRESSION"   // e.g. authMiddleware.checkRole
  | "FACTORY_CALL"        // e.g. rateLimit({ max: 100 })
  | "INLINE_FUNCTION";    // e.g. (req, res, next) => { ... }

export interface MiddlewareMetadata {
  executionOrder: number;
  type: MiddlewareType;
  name: string | null;           // Identifier name if named, otherwise null
  rawExpression: string;        // Exact code string representation
  isInline: boolean;
  params?: string[];            // Parameter names if inline function, e.g. ["req", "res", "next"]
  loc: SourceLocation;
}

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "OPTIONS"
  | "HEAD"
  | "ALL";

export interface RouteRegistration {
  registrationType: "ROUTE";
  routerIdentifier: string;     // The variable name of the router on which this route is registered
  httpMethod: HttpMethod;
  path: RoutePath;
  middlewares: MiddlewareMetadata[]; // Ordered list of middlewares culminating in the handler
  loc: SourceLocation;
}

export interface MountRegistration {
  registrationType: "MOUNT";
  parentRouter: string;         // e.g. "app"
  subRouterIdentifier: string;  // e.g. "userRouter" or imported identifier
  path: RoutePath;              // Mount prefix e.g. "/api/users"
  loc: SourceLocation;
}

export type ExportType = "DEFAULT" | "NAMED";

export interface ExportMetadata {
  type: ExportType;
  exportName?: string;          // Set for named exports
  localIdentifier: string;      // The local identifier being exported
  loc: SourceLocation;
}

export interface SourceFileMetadata {
  filePath: string;
  routersDeclared: RouterDeclaration[];
  routeRegistrations: RouteRegistration[];
  mounts: MountRegistration[];
  exports: ExportMetadata[];
}

export interface ExpressFlowManifest {
  version: "1.0.0";
  analyzedAt: string;
  projectRoot: string;
  files: SourceFileMetadata[];
}
