/**
 * Dependency propagation and cycle detection.
 *
 * Status rules:
 * - PENDING: one or more upstream inputs incomplete
 * - ACTIVE: all inputs satisfied, awaiting completion
 * - COMPLETE: marked complete by owner
 * - BLOCKED: was active but a dependency has been reopened
 */

export function propagateStatuses(nodes, edges) {
  // Build adjacency: for each node, find its upstream (source) nodes
  const incomingMap = new Map();
  for (const edge of edges) {
    if (!incomingMap.has(edge.target)) {
      incomingMap.set(edge.target, []);
    }
    incomingMap.get(edge.target).push(edge.source);
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return nodes.map((node) => {
    // Complete nodes stay complete (user controls this)
    if (node.data.status === 'complete') return node;

    const upstreamIds = incomingMap.get(node.id) || [];
    if (upstreamIds.length === 0) {
      // No dependencies — active
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
      // All inputs satisfied
      if (node.data.status === 'pending' || node.data.status === 'blocked') {
        return { ...node, data: { ...node.data, status: 'active' } };
      }
    } else if (anyIncomplete) {
      // Dependencies unmet
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
 * Returns true if a cycle exists.
 */
export function detectCycle(nodes, edges) {
  const adjList = new Map();
  for (const node of nodes) {
    adjList.set(node.id, []);
  }
  for (const edge of edges) {
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
