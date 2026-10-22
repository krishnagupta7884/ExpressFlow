import { HttpMethod, SourceLocation } from "../../shared/types/manifest";
import { ComposedMiddleware } from "../composer/routeComposer";

export type CfgNodeType =
  | "ENTRY"
  | "GLOBAL_MIDDLEWARE"
  | "MOUNT_MIDDLEWARE"
  | "ROUTER_MIDDLEWARE"
  | "ROUTE_MIDDLEWARE"
  | "CONTROLLER_HANDLER"
  | "EXIT";

export type CfgEdgeType = "NEXT" | "TERMINAL" | "BYPASS" | "ERROR";

export interface CfgNode {
  id: string;                    // Unique node identifier within CFG
  type: CfgNodeType;
  label: string;                 // Human-readable node label
  executionIndex: number;        // Sequence index in execution flow
  middleware: ComposedMiddleware | null;
  sourceFile?: string;
  loc?: SourceLocation;
  predecessors: string[];        // Node IDs of incoming edges
  successors: string[];          // Node IDs of outgoing edges
}

export interface CfgEdge {
  id: string;                    // e.g. "e_entry_to_m0"
  from: string;                  // Source node ID
  to: string;                    // Target node ID
  type: CfgEdgeType;
  label?: string;
}

export interface RouteCfg {
  routeId: string;               // e.g. "DELETE /api/users/:id"
  method: HttpMethod;
  fullPath: string;
  nodes: CfgNode[];
  edges: CfgEdge[];
  entryNodeId: string;
  exitNodeId: string;
  terminalHandlerNodeId: string | null;
  nodeCount: number;
  edgeCount: number;
  sourceFile: string;
  loc: SourceLocation;
}
