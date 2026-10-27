import { CfgNode, RouteCfg } from "../cfg/cfgModel";

export interface DominatorTreeNode {
  nodeId: string;
  dominators: Set<string>;      // All nodes that dominate this node
  idom: string | null;          // Immediate dominator
  children: string[];           // Children in the dominator tree
}

export interface DominatorTree {
  cfg: RouteCfg;
  nodes: Map<string, DominatorTreeNode>;
  rootId: string;
  dominates: (d: string, n: string) => boolean;
  strictlyDominates: (d: string, n: string) => boolean;
  getIdom: (n: string) => string | null;
  getDominators: (n: string) => Set<string>;
}

/**
 * Computes the formal Dominator Tree for a Control-Flow Graph using
 * standard compiler iterative data-flow analysis.
 *
 * Formal Definition:
 * Node d dominates node n (d dom n) iff every execution path from ENTRY to n must traverse d.
 */
export function computeDominatorTree(cfg: RouteCfg): DominatorTree {
  const allNodeIds = cfg.nodes.map((n) => n.id);
  const entryId = cfg.entryNodeId;

  // Map of predecessors for each node
  const predMap = new Map<string, string[]>();
  for (const node of cfg.nodes) {
    predMap.set(node.id, [...node.predecessors]);
  }

  // 1. Initialize Dominance Sets
  // Dom(ENTRY) = { ENTRY }
  // Dom(n) = ALL_NODES for n != ENTRY
  const domMap = new Map<string, Set<string>>();

  for (const nodeId of allNodeIds) {
    if (nodeId === entryId) {
      domMap.set(nodeId, new Set([entryId]));
    } else {
      domMap.set(nodeId, new Set(allNodeIds));
    }
  }

  // 2. Iterative Dataflow Solver until fixed-point convergence
  // Dom(n) = {n} U ( INTERSECT_{p in Pred(n)} Dom(p) )
  let changed = true;
  while (changed) {
    changed = false;

    for (const nodeId of allNodeIds) {
      if (nodeId === entryId) continue;

      const preds = predMap.get(nodeId) || [];
      if (preds.length === 0) continue;

      // Compute intersection of dominators of all predecessors
      let intersection: Set<string> | null = null;

      for (const pred of preds) {
        const predDom = domMap.get(pred);
        if (!predDom) continue;

        if (intersection === null) {
          intersection = new Set(predDom);
        } else {
          for (const elem of intersection) {
            if (!predDom.has(elem)) {
              intersection.delete(elem);
            }
          }
        }
      }

      const newDom = new Set<string>(intersection || []);
      newDom.add(nodeId); // Every node dominates itself

      const currentDom = domMap.get(nodeId)!;
      if (newDom.size !== currentDom.size || ![...newDom].every((x) => currentDom.has(x))) {
        domMap.set(nodeId, newDom);
        changed = true;
      }
    }
  }

  // 3. Compute Immediate Dominators (idom)
  // idom(n) is the unique strict dominator d of n that does not dominate any other strict dominator of n
  const idomMap = new Map<string, string | null>();
  const childrenMap = new Map<string, string[]>();

  for (const nodeId of allNodeIds) {
    childrenMap.set(nodeId, []);
  }

  for (const nodeId of allNodeIds) {
    if (nodeId === entryId) {
      idomMap.set(nodeId, null);
      continue;
    }

    const strictDoms = new Set(domMap.get(nodeId)!);
    strictDoms.delete(nodeId); // sdom(n) = Dom(n) \ {n}

    let immediateDom: string | null = null;

    for (const d of strictDoms) {
      // Check if d is dominated by any other strict dominator of n
      let isDominatedByOther = false;
      for (const other of strictDoms) {
        if (other !== d && domMap.get(other)?.has(d)) {
          isDominatedByOther = true;
          break;
        }
      }

      if (!isDominatedByOther) {
        immediateDom = d;
        break;
      }
    }

    idomMap.set(nodeId, immediateDom);
    if (immediateDom && childrenMap.has(immediateDom)) {
      childrenMap.get(immediateDom)!.push(nodeId);
    }
  }

  // 4. Construct Dominator Tree Nodes
  const treeNodes = new Map<string, DominatorTreeNode>();
  for (const nodeId of allNodeIds) {
    treeNodes.set(nodeId, {
      nodeId,
      dominators: domMap.get(nodeId) || new Set([nodeId]),
      idom: idomMap.get(nodeId) || null,
      children: childrenMap.get(nodeId) || [],
    });
  }

  const dominates = (d: string, n: string): boolean => {
    return domMap.get(n)?.has(d) ?? false;
  };

  const strictlyDominates = (d: string, n: string): boolean => {
    return d !== n && dominates(d, n);
  };

  const getIdom = (n: string): string | null => {
    return idomMap.get(n) || null;
  };

  const getDominators = (n: string): Set<string> => {
    return domMap.get(n) || new Set();
  };

  return {
    cfg,
    nodes: treeNodes,
    rootId: entryId,
    dominates,
    strictlyDominates,
    getIdom,
    getDominators,
  };
}
