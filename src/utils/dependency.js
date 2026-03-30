/**
 * Dependency propagation, cycle detection, and chain tracing.
 *
 * Status rules:
 * - PENDING: one or more upstream inputs incomplete
 * - ACTIVE: all inputs satisfied, awaiting completion
 * - COMPLETE: marked complete by owner
 * - BLOCKED: was active but a dependency has been reopened
 *
 * Loop edges (edge.data.loop === true) are excluded from:
 * - Cycle detection (they are intentional back-edges)
 * - Status propagation (they re-trigger, not prerequisite)
 */

export function propagateStatuses(nodes, edges) {
  // Build adjacency: for each node, find its upstream (source) nodes
  // Exclude loop edges — they are re-triggers, not prerequisites
  const incomingMap = new Map();
  for (const edge of edges) {
    if (edge.data?.loop) continue; // skip loop edges
    if (!incomingMap.has(edge.target)) {
      incomingMap.set(edge.target, []);
    }
    incomingMap.get(edge.target).push(edge.source);
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return nodes.map((node) => {
    if (node.data.status === 'complete') return node;

    const upstreamIds = incomingMap.get(node.id) || [];
    if (upstreamIds.length === 0) {
      if (node.data.status === 'pending') {
        return { ...node, data: { ...node.data, status: 'active' } };
      }
      return node;
    }

    const allComplete = upstreamIds.every((id) => {
      const upstream = nodeMap.get(id);
      return upstream && upstream.data.status === 'complete';
    });

    const anyIncomplete = upstreamIds.some((id) => {
      const upstream = nodeMap.get(id);
      return !upstream || upstream.data.status !== 'complete';
    });

    if (allComplete) {
      if (node.data.status === 'pending' || node.data.status === 'blocked') {
        return { ...node, data: { ...node.data, status: 'active' } };
      }
    } else if (anyIncomplete) {
      if (node.data.status === 'active') {
        return { ...node, data: { ...node.data, status: 'blocked' } };
      } else if (node.data.status !== 'blocked') {
        return { ...node, data: { ...node.data, status: 'pending' } };
      }
    }

    return node;
  });
}

/**
 * Detect circular dependencies using DFS.
 * Edges marked with data.loop === true are excluded — they are intentional.
 * Returns true if a non-loop cycle exists.
 */
export function detectCycle(nodes, edges) {
  const adjList = new Map();
  for (const node of nodes) {
    adjList.set(node.id, []);
  }
  for (const edge of edges) {
    if (edge.data?.loop) continue; // skip loop edges
    if (adjList.has(edge.source)) {
      adjList.get(edge.source).push(edge.target);
    }
  }

  const visited = new Set();
  const inStack = new Set();

  function dfs(nodeId) {
    visited.add(nodeId);
    inStack.add(nodeId);

    const neighbors = adjList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (inStack.has(neighbor)) return true;
      if (!visited.has(neighbor) && dfs(neighbor)) return true;
    }

    inStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }

  return false;
}

/**
 * Find all nodes and edges in the upstream and downstream chain of a given node.
 * Returns { nodeIds: Set, edgeIds: Set }
 */
export function traceChain(nodeId, edges) {
  const nodeIds = new Set([nodeId]);
  const edgeIds = new Set();

  const downstream = new Map();
  const upstream = new Map();
  for (const e of edges) {
    if (!downstream.has(e.source)) downstream.set(e.source, []);
    downstream.get(e.source).push({ target: e.target, edgeId: e.id });
    if (!upstream.has(e.target)) upstream.set(e.target, []);
    upstream.get(e.target).push({ source: e.source, edgeId: e.id });
  }

  const queue = [nodeId];
  const visited = new Set([nodeId]);
  while (queue.length > 0) {
    const current = queue.shift();
    for (const { target, edgeId } of downstream.get(current) || []) {
      edgeIds.add(edgeId);
      nodeIds.add(target);
      if (!visited.has(target)) {
        visited.add(target);
        queue.push(target);
      }
    }
  }

  const queue2 = [nodeId];
  const visited2 = new Set([nodeId]);
  while (queue2.length > 0) {
    const current = queue2.shift();
    for (const { source, edgeId } of upstream.get(current) || []) {
      edgeIds.add(edgeId);
      nodeIds.add(source);
      if (!visited2.has(source)) {
        visited2.add(source);
        queue2.push(source);
      }
    }
  }

  return { nodeIds, edgeIds };
}
