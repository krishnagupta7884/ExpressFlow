import { ComposedMiddleware, ComposedRoute } from "../composer/routeComposer";
import { CfgEdge, CfgEdgeType, CfgNode, CfgNodeType, RouteCfg } from "./cfgModel";

/**
 * Builds a directed Control-Flow Graph (CFG) for an individual composed route.
 */
export function buildRouteCfg(route: ComposedRoute): RouteCfg {
  const nodes: CfgNode[] = [];
  const edges: CfgEdge[] = [];

  const entryNodeId = "ENTRY";
  const exitNodeId = "EXIT";

  // 1. Create ENTRY Node
  const entryNode: CfgNode = {
    id: entryNodeId,
    type: "ENTRY",
    label: `ENTRY: ${route.httpMethod} ${route.fullPath}`,
    executionIndex: 0,
    middleware: null,
    sourceFile: route.sourceFile,
    loc: route.loc,
    predecessors: [],
    successors: [],
  };
  nodes.push(entryNode);

  // 2. Create Middleware / Handler Nodes
  const totalMws = route.effectiveMiddlewares.length;
  let terminalHandlerNodeId: string | null = null;

  route.effectiveMiddlewares.forEach((mw, index) => {
    const isTerminal = index === totalMws - 1;
    let nodeType: CfgNodeType = "ROUTE_MIDDLEWARE";

    if (isTerminal) {
      nodeType = "CONTROLLER_HANDLER";
    } else {
      switch (mw.scope) {
        case "GLOBAL":
          nodeType = "GLOBAL_MIDDLEWARE";
          break;
        case "MOUNT":
          nodeType = "MOUNT_MIDDLEWARE";
          break;
        case "ROUTER":
          nodeType = "ROUTER_MIDDLEWARE";
          break;
        case "ROUTE":
        default:
          nodeType = "ROUTE_MIDDLEWARE";
          break;
      }
    }

    const nodeId = isTerminal ? "HANDLER" : `MW_${index}`;
    if (isTerminal) {
      terminalHandlerNodeId = nodeId;
    }

    const labelName = mw.name || (mw.isInline ? `inline(${mw.params?.join(", ") || ""})` : mw.rawExpression);

    const node: CfgNode = {
      id: nodeId,
      type: nodeType,
      label: `[${mw.scope}] ${labelName}`,
      executionIndex: index + 1,
      middleware: mw,
      sourceFile: mw.sourceFile,
      loc: mw.loc,
      predecessors: [],
      successors: [],
    };

    nodes.push(node);
  });

  // 3. Create EXIT Node
  const exitNode: CfgNode = {
    id: exitNodeId,
    type: "EXIT",
    label: "EXIT (HTTP Response)",
    executionIndex: totalMws + 1,
    middleware: null,
    sourceFile: route.sourceFile,
    loc: route.loc,
    predecessors: [],
    successors: [],
  };
  nodes.push(exitNode);

  // 4. Construct Edges Sequentially
  for (let i = 0; i < nodes.length - 1; i++) {
    const fromNode = nodes[i];
    const toNode = nodes[i + 1];

    fromNode.successors.push(toNode.id);
    toNode.predecessors.push(fromNode.id);

    let edgeType: CfgEdgeType = "NEXT";
    let edgeLabel = "next()";

    if (fromNode.id === entryNodeId) {
      edgeType = "NEXT";
      edgeLabel = "HTTP Request";
    } else if (toNode.id === exitNodeId) {
      edgeType = "TERMINAL";
      edgeLabel = "Response Sent";
    }

    edges.push({
      id: `edge_${fromNode.id}_to_${toNode.id}`,
      from: fromNode.id,
      to: toNode.id,
      type: edgeType,
      label: edgeLabel,
    });
  }

  return {
    routeId: route.id,
    method: route.httpMethod,
    fullPath: route.fullPath,
    nodes,
    edges,
    entryNodeId,
    exitNodeId,
    terminalHandlerNodeId,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    sourceFile: route.sourceFile,
    loc: route.loc,
  };
}

/**
 * Builds CFGs for all composed routes in a project.
 */
export function buildProjectCfgs(routes: ComposedRoute[]): RouteCfg[] {
  return routes.map((r) => buildRouteCfg(r));
}

/**
 * Formats a Route CFG into a clean ASCII flowchart for terminal output and review presentation.
 */
export function toAscii(cfg: RouteCfg): string {
  const lines: string[] = [];
  lines.push(`+----------------------------------------------------------------`);
  lines.push(`| CFG: ${cfg.method} ${cfg.fullPath} (${cfg.sourceFile}:${cfg.loc.start.line})`);
  lines.push(`+----------------------------------------------------------------`);

  for (let i = 0; i < cfg.nodes.length; i++) {
    const node = cfg.nodes[i];
    const isEntry = node.id === cfg.entryNodeId;
    const isExit = node.id === cfg.exitNodeId;
    const isHandler = node.id === cfg.terminalHandlerNodeId;

    let marker = "[MW]";
    if (isEntry) marker = "[START]";
    else if (isExit) marker = "[END]  ";
    else if (isHandler) marker = "[ACTN] ";

    const locInfo = node.loc && node.loc.start.line > 0
      ? `(${node.sourceFile}:${node.loc.start.line}:${node.loc.start.column})`
      : "";

    lines.push(`  ${marker} ${node.label} ${locInfo}`);

    if (i < cfg.nodes.length - 1) {
      const edge = cfg.edges[i];
      lines.push(`         |  ${edge.label || ""}`);
      lines.push(`         v`);
    }
  }

  lines.push(`+----------------------------------------------------------------\n`);
  return lines.join("\n");
}

/**
 * Converts a Route CFG into Graphviz DOT syntax.
 */
export function toDot(cfg: RouteCfg): string {
  const lines: string[] = [];
  const safeId = cfg.routeId.replace(/[^a-zA-Z0-9]/g, "_");

  lines.push(`digraph CFG_${safeId} {`);
  lines.push(`  rankdir=TB;`);
  lines.push(`  node [fontname="Helvetica", fontsize=10];`);
  lines.push(`  edge [fontname="Helvetica", fontsize=9];`);
  lines.push(`  labelloc="t";`);
  lines.push(`  label="CFG: ${cfg.method} ${cfg.fullPath}";`);

  for (const node of cfg.nodes) {
    let shape = "box";
    let style = "filled";
    let fillcolor = "#f4f4f4";
    let color = "#333333";

    if (node.id === cfg.entryNodeId) {
      shape = "ellipse";
      fillcolor = "#d4edda";
      color = "#28a745";
    } else if (node.id === cfg.exitNodeId) {
      shape = "ellipse";
      fillcolor = "#f8d7da";
      color = "#dc3545";
    } else if (node.id === cfg.terminalHandlerNodeId) {
      shape = "doubleoctagon";
      fillcolor = "#fff3cd";
      color = "#ffc107";
    } else if (node.type === "GLOBAL_MIDDLEWARE") {
      fillcolor = "#cce5ff";
      color = "#004085";
    }

    const escapedLabel = node.label.replace(/"/g, '\\"');
    lines.push(`  "${node.id}" [label="${escapedLabel}", shape=${shape}, style="${style}", fillcolor="${fillcolor}", color="${color}"];`);
  }

  for (const edge of cfg.edges) {
    const escapedLabel = (edge.label || "").replace(/"/g, '\\"');
    lines.push(`  "${edge.from}" -> "${edge.to}" [label="${escapedLabel}"];`);
  }

  lines.push(`}`);
  return lines.join("\n");
}

/**
 * Converts a Route CFG into Mermaid flowchart syntax.
 */
export function toMermaid(cfg: RouteCfg): string {
  const lines: string[] = [];
  lines.push(`%% CFG: ${cfg.method} ${cfg.fullPath}`);
  lines.push(`flowchart TD`);

  for (const node of cfg.nodes) {
    const safeLabel = node.label.replace(/["\[\]\(\)]/g, "");
    if (node.id === cfg.entryNodeId) {
      lines.push(`  ${node.id}(["${safeLabel}"])`);
    } else if (node.id === cfg.exitNodeId) {
      lines.push(`  ${node.id}(["${safeLabel}"])`);
    } else if (node.id === cfg.terminalHandlerNodeId) {
      lines.push(`  ${node.id}{{"${safeLabel}"}}`);
    } else {
      lines.push(`  ${node.id}["${safeLabel}"]`);
    }
  }

  for (const edge of cfg.edges) {
    lines.push(`  ${edge.from} -->|${edge.label || ""}| ${edge.to}`);
  }

  return lines.join("\n");
}
