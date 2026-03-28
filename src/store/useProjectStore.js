import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { propagateStatuses, detectCycle } from '../utils/dependency';
import { generateId } from '../utils/id';

const RIBA_STAGES = [
  { key: '0', label: 'Stage 0 — Strategic Definition' },
  { key: '1', label: 'Stage 1 — Preparation & Briefing' },
  { key: '2', label: 'Stage 2 — Concept Design' },
  { key: '3', label: 'Stage 3 — Spatial Coordination' },
  { key: '4', label: 'Stage 4 — Technical Design' },
  { key: '5', label: 'Stage 5 — Manufacturing & Construction' },
  { key: '6', label: 'Stage 6 — Handover' },
  { key: '7', label: 'Stage 7 — Use' },
];

const DEFAULT_STAGE_WIDTH = 260;

const useProjectStore = create((set, get) => ({
  // App state
  screen: 'setup', // 'setup' | 'canvas'
  project: {
    follow_version: '0.1',
    project: {
      name: '',
      client: '',
      address: '',
      created: new Date().toISOString().split('T')[0],
      stages: {},
      contacts: [],
    },
    nodes: [],
    edges: [],
    canvas: { zoom: 1.0, pan_x: 0, pan_y: 0 },
  },
  nodes: [],
  edges: [],
  selectedNode: null,
  readOnly: false,

  ribaStages: RIBA_STAGES,

  // Project setup
  initProject: (setup) => {
    const stages = {};
    RIBA_STAGES.forEach((s) => {
      stages[s.key] = {
        active: setup.activeStages.includes(s.key),
        in_appointment: setup.appointmentStages.includes(s.key),
        width: DEFAULT_STAGE_WIDTH,
      };
    });

    const contacts = setup.contacts.map((c, i) => ({
      id: `c${String(i + 1).padStart(2, '0')}`,
      name: c.name || null,
      org: c.org || null,
      discipline: c.discipline || '',
      email: c.email || '',
      unassigned: !c.name,
    }));

    const project = {
      follow_version: '0.1',
      project: {
        name: setup.name,
        client: setup.client,
        address: setup.address,
        created: new Date().toISOString().split('T')[0],
        stages,
        contacts,
      },
      nodes: [],
      edges: [],
      canvas: { zoom: 1.0, pan_x: 0, pan_y: 0 },
    };

    set({ project, nodes: [], edges: [], screen: 'canvas' });
  },

  // Load from JSON
  loadProject: (json) => {
    const nodes = (json.nodes || []).map((n) => ({
      id: n.id,
      type: n.type === 'milestone' ? 'milestone' : n.type === 'user_checkpoint' ? 'checkpoint' : n.type === 'information_request' ? 'infoRequest' : 'workPackage',
      position: n.position || { x: 0, y: 0 },
      data: {
        label: n.label,
        nodeType: n.type,
        stage: n.stage,
        role: n.role,
        status: n.status || 'pending',
        notes: n.notes || '',
        target_date: n.target_date,
        linked_docs: n.linked_docs || [],
        typical_inputs: n.typical_inputs || [],
        groups: n.groups || [],
        history: n.history || [],
      },
    }));

    const edges = (json.edges || []).map((e) => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.source_handle || 'output',
      target: e.target,
      targetHandle: e.target_handle || 'input',
      animated: true,
      type: 'smoothstep',
    }));

    set({
      project: json,
      nodes,
      edges,
      screen: 'canvas',
      readOnly: false,
    });
  },

  loadReadOnly: (json) => {
    const state = get();
    state.loadProject(json);
    set({ readOnly: true });
  },

  // Export to JSON
  exportProject: () => {
    const { project, nodes, edges } = get();
    const exportNodes = nodes.map((n) => ({
      id: n.id,
      label: n.data.label,
      type: n.data.nodeType,
      stage: n.data.stage,
      role: n.data.role,
      status: n.data.status,
      position: n.position,
      notes: n.data.notes,
      target_date: n.data.target_date,
      linked_docs: n.data.linked_docs,
      typical_inputs: n.data.typical_inputs,
      groups: n.data.groups || [],
      history: n.data.history,
    }));

    const exportEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      source_handle: e.sourceHandle || 'output',
      target: e.target,
      target_handle: e.targetHandle || 'input',
    }));

    return {
      ...project,
      nodes: exportNodes,
      edges: exportEdges,
    };
  },

  // Canvas actions
  onNodesChange: (changes) => {
    set((state) => {
      const newNodes = applyNodeChanges(changes, state.nodes);
      const { project } = state;
      const stageColumns = getStageColumns(project.project.stages);
      for (const node of newNodes) {
        if (node.position) {
          const stage = getStageForPosition(node.position.x, stageColumns);
          if (stage !== null && node.data.stage !== stage) {
            node.data = { ...node.data, stage };
          }
        }
      }
      return { nodes: newNodes };
    });
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },

  onConnect: (connection) => {
    const { nodes, edges } = get();
    const targetNode = nodes.find((n) => n.id === connection.target);
    const sourceNode = nodes.find((n) => n.id === connection.source);

    // Resolve the output label from the source handle
    const resolveSourceOutputLabel = () => {
      if (!sourceNode || !connection.sourceHandle) return 'Input';
      // Handle format: "output-{groupId}-{outputId}" or "output"
      const parts = connection.sourceHandle.split('-');
      if (parts.length >= 3 && parts[0] === 'output') {
        const srcGroupId = parts[1];
        const srcOutputId = parts.slice(2).join('-');
        const srcGroup = (sourceNode.data.groups || []).find((g) => g.id === srcGroupId);
        if (srcGroup) {
          const srcOutput = srcGroup.outputs.find((o) => o.id === srcOutputId);
          if (srcOutput) return srcOutput.label;
        }
      }
      return sourceNode.data.label || 'Input';
    };

    // If the target handle is "new-group", create a new group on the target node
    if (connection.targetHandle === 'new-group' && targetNode) {
      const groupId = `g_${generateId()}`;
      const outputId = `o_${generateId()}`;
      const inputLabel = resolveSourceOutputLabel();
      const newGroup = {
        id: groupId,
        inputLabel,
        outputs: [{ id: outputId, label: 'Output' }],
      };

      // Update node to add the new group
      const updatedNodes = nodes.map((n) => {
        if (n.id === connection.target) {
          return {
            ...n,
            data: {
              ...n.data,
              groups: [...(n.data.groups || []), newGroup],
            },
          };
        }
        return n;
      });

      // Create edge pointing to the new group's input
      const newEdge = {
        id: `edge_${generateId()}`,
        source: connection.source,
        sourceHandle: connection.sourceHandle,
        target: connection.target,
        targetHandle: `input-${groupId}`,
        animated: true,
        type: 'smoothstep',
      };

      const testEdges = [...edges, newEdge];
      if (detectCycle(updatedNodes, testEdges)) {
        alert('Circular dependency detected. This connection is not allowed.');
        return;
      }

      const finalNodes = propagateStatuses(updatedNodes, testEdges);
      set({ nodes: finalNodes, edges: testEdges });
      return;
    }

    // Standard connection
    const newEdge = {
      id: `edge_${generateId()}`,
      source: connection.source,
      sourceHandle: connection.sourceHandle,
      target: connection.target,
      targetHandle: connection.targetHandle,
      animated: true,
      type: 'smoothstep',
    };

    const testEdges = [...edges, newEdge];
    if (detectCycle(nodes, testEdges)) {
      alert('Circular dependency detected. This connection is not allowed.');
      return;
    }

    // Auto-name: if target input still has a default label, rename it from the source output
    let updatedNodes = [...nodes];
    if (targetNode && connection.targetHandle?.startsWith('input-')) {
      const targetGroupId = connection.targetHandle.replace('input-', '');
      const targetGroup = (targetNode.data.groups || []).find((g) => g.id === targetGroupId);
      if (targetGroup && (!targetGroup.inputLabel || targetGroup.inputLabel === 'Input' || targetGroup.inputLabel === 'New input')) {
        const label = resolveSourceOutputLabel();
        if (label !== 'Input') {
          updatedNodes = updatedNodes.map((n) => {
            if (n.id !== connection.target) return n;
            const groups = (n.data.groups || []).map((g) => {
              if (g.id !== targetGroupId) return g;
              return { ...g, inputLabel: label };
            });
            return { ...n, data: { ...n.data, groups } };
          });
        }
      }
    }

    const finalNodes = propagateStatuses(updatedNodes, testEdges);
    set({ edges: testEdges, nodes: finalNodes });
  },

  // Node CRUD
  addNode: (nodeType, position, stage) => {
    const id = `node_${generateId()}`;
    const rfType = nodeType === 'milestone' ? 'milestone' : nodeType === 'user_checkpoint' ? 'checkpoint' : nodeType === 'information_request' ? 'infoRequest' : 'workPackage';

    // Default group for work packages and info requests
    const defaultGroups = (rfType === 'workPackage' || rfType === 'infoRequest') ? [{
      id: `g_${generateId()}`,
      inputLabel: 'Input',
      outputs: [{ id: `o_${generateId()}`, label: 'Output' }],
    }] : [];

    const newNode = {
      id,
      type: rfType,
      position,
      data: {
        label: nodeType === 'work_package' ? 'New Work Package'
          : nodeType === 'information_request' ? 'New Info Request'
          : nodeType === 'milestone' ? 'New Milestone'
          : 'New Checkpoint',
        nodeType,
        stage,
        role: null,
        status: 'active',
        notes: '',
        target_date: null,
        linked_docs: [],
        typical_inputs: [],
        groups: defaultGroups,
        history: [{ event: 'created', timestamp: new Date().toISOString() }],
      },
    };
    set((state) => ({ nodes: [...state.nodes, newNode] }));
    return id;
  },

  updateNodeData: (nodeId, data) => {
    set((state) => {
      const nodes = state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
      );
      const updated = propagateStatuses(nodes, state.edges);
      return { nodes: updated };
    });
  },

  // Group management
  addGroupToNode: (nodeId) => {
    set((state) => {
      const groupId = `g_${generateId()}`;
      const outputId = `o_${generateId()}`;
      const nodes = state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          data: {
            ...n.data,
            groups: [...(n.data.groups || []), {
              id: groupId,
              inputLabel: 'New input',
              outputs: [{ id: outputId, label: 'Output' }],
            }],
          },
        };
      });
      return { nodes };
    });
  },

  addOutputToGroup: (nodeId, groupId) => {
    set((state) => {
      const outputId = `o_${generateId()}`;
      const nodes = state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const groups = (n.data.groups || []).map((g) => {
          if (g.id !== groupId) return g;
          return { ...g, outputs: [...g.outputs, { id: outputId, label: 'Output' }] };
        });
        return { ...n, data: { ...n.data, groups } };
      });
      return { nodes };
    });
  },

  updateGroup: (nodeId, groupId, updates) => {
    set((state) => {
      const nodes = state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const groups = (n.data.groups || []).map((g) => {
          if (g.id !== groupId) return g;
          return { ...g, ...updates };
        });
        return { ...n, data: { ...n.data, groups } };
      });
      return { nodes };
    });
  },

  updateOutput: (nodeId, groupId, outputId, updates) => {
    set((state) => {
      const nodes = state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const groups = (n.data.groups || []).map((g) => {
          if (g.id !== groupId) return g;
          const outputs = g.outputs.map((o) =>
            o.id === outputId ? { ...o, ...updates } : o
          );
          return { ...g, outputs };
        });
        return { ...n, data: { ...n.data, groups } };
      });
      return { nodes };
    });
  },

  removeGroup: (nodeId, groupId) => {
    set((state) => {
      const nodes = state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          data: {
            ...n.data,
            groups: (n.data.groups || []).filter((g) => g.id !== groupId),
          },
        };
      });
      // Also remove edges connected to this group's handles
      const edges = state.edges.filter((e) => {
        if (e.target === nodeId && e.targetHandle === `input-${groupId}`) return false;
        if (e.source === nodeId && e.sourceHandle?.startsWith(`output-${groupId}-`)) return false;
        return true;
      });
      return { nodes, edges };
    });
  },

  removeOutput: (nodeId, groupId, outputId) => {
    set((state) => {
      const nodes = state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const groups = (n.data.groups || []).map((g) => {
          if (g.id !== groupId) return g;
          return { ...g, outputs: g.outputs.filter((o) => o.id !== outputId) };
        });
        return { ...n, data: { ...n.data, groups } };
      });
      // Remove edges from this output
      const edges = state.edges.filter((e) => {
        if (e.source === nodeId && e.sourceHandle === `output-${groupId}-${outputId}`) return false;
        return true;
      });
      return { nodes, edges };
    });
  },

  deleteNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNode: state.selectedNode === nodeId ? null : state.selectedNode,
    }));
  },

  selectNode: (nodeId) => set({ selectedNode: nodeId }),
  deselectNode: () => set({ selectedNode: null }),

  // Contacts
  addContact: (contact) => {
    set((state) => {
      const id = `c${String(state.project.project.contacts.length + 1).padStart(2, '0')}`;
      const newContact = { id, ...contact, unassigned: !contact.name };
      return {
        project: {
          ...state.project,
          project: {
            ...state.project.project,
            contacts: [...state.project.project.contacts, newContact],
          },
        },
      };
    });
  },

  // Stage column widths
  setStageWidth: (stageKey, width) => {
    set((state) => ({
      project: {
        ...state.project,
        project: {
          ...state.project.project,
          stages: {
            ...state.project.project.stages,
            [stageKey]: {
              ...state.project.project.stages[stageKey],
              width: Math.max(160, width),
            },
          },
        },
      },
    }));
  },

  propagateAll: () => {
    set((state) => {
      const updated = propagateStatuses(state.nodes, state.edges);
      return { nodes: updated };
    });
  },
}));

export function getStageColumns(stages) {
  const cols = [];
  let x = 0;
  for (let i = 0; i <= 7; i++) {
    const key = String(i);
    const stage = stages[key];
    if (stage) {
      cols.push({ key, x, width: stage.width || DEFAULT_STAGE_WIDTH, inAppointment: stage.in_appointment });
      x += stage.width || DEFAULT_STAGE_WIDTH;
    }
  }
  return cols;
}

export function getStageForPosition(posX, stageColumns) {
  for (const col of stageColumns) {
    if (posX >= col.x && posX < col.x + col.width) {
      return parseInt(col.key);
    }
  }
  if (stageColumns.length > 0) {
    const last = stageColumns[stageColumns.length - 1];
    if (posX >= last.x + last.width) return parseInt(last.key);
  }
  return stageColumns.length > 0 ? parseInt(stageColumns[0].key) : 0;
}

export { RIBA_STAGES, DEFAULT_STAGE_WIDTH };
export default useProjectStore;
