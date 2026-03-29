import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import useProjectStore, { RIBA_STAGES } from '../store/useProjectStore';
import { generateId } from '../utils/id';
import WorkPackageNode from '../nodes/WorkPackageNode';
import DecisionNode from '../nodes/DecisionNode';
import CheckpointNode from '../nodes/CheckpointNode';
import Toolbar from './Toolbar';
import PropertiesPanel, { pendingModuleRef } from './PropertiesPanel';
import DeletableEdge from './DeletableEdge';
import { STAGE_COLORS } from '../utils/colors';

const nodeTypes = {
  workPackage: WorkPackageNode,
  decision: DecisionNode,
  checkpoint: CheckpointNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
};

const defaultEdgeOptions = {
  animated: false,
  style: { stroke: '#38bdf8', strokeWidth: 2 },
  type: 'deletable',
};

// Stage navigation bar with dots
function StageNav({ currentStage, stages, onSelect }) {
  const stageKeys = Object.keys(stages).sort((a, b) => parseInt(a) - parseInt(b));
  const stageInfo = RIBA_STAGES.find((s) => s.key === String(currentStage));
  const inAppointment = stages[String(currentStage)]?.in_appointment;
  const colorIdx = parseInt(currentStage);

  return (
    <div style={{
      position: 'absolute',
      top: 44,
      left: 0,
      right: 0,
      height: 32,
      background: '#16162aee',
      borderBottom: '1px solid #2a2a3e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9,
    }}>
      {/* Stage dots */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {stageKeys.map((key) => {
          const isActive = key === String(currentStage);
          const isInAppt = stages[key]?.in_appointment;
          const ci = parseInt(key);
          const label = RIBA_STAGES.find((s) => s.key === key)?.label || `Stage ${key}`;
          return (
            <button
              key={key}
              onClick={() => onSelect(parseInt(key))}
              style={{
                height: 22,
                padding: isActive ? '0 10px' : '0 4px',
                borderRadius: 11,
                background: isActive ? (STAGE_COLORS[ci] || '#60a5fa') + '30' : 'transparent',
                border: isActive ? `1px solid ${STAGE_COLORS[ci] || '#60a5fa'}` : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title={label}
            >
              <div style={{
                width: 6, height: 6, borderRadius: 3,
                background: isActive ? (STAGE_COLORS[ci] || '#60a5fa') : isInAppt ? '#4a4a5e' : '#2a2a3e',
                transition: 'background 0.2s ease',
              }} />
              {isActive && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: STAGE_COLORS[ci] || '#d1d5db',
                  whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!inAppointment && (
        <span style={{
          position: 'absolute', right: 12,
          fontSize: 9, color: '#6b7280', fontStyle: 'italic',
        }}>
          outside appointment
        </span>
      )}
    </div>
  );
}

// Hover chevron on screen edge
function EdgeChevron({ side, visible, onClick, label }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side]: 0,
        width: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: visible ? 'pointer' : 'default',
        zIndex: 8,
        opacity: hovered && visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div style={{
        width: 36,
        height: 100,
        background: 'linear-gradient(' +
          (side === 'left' ? '90deg' : '270deg') +
          ', rgba(59,130,246,0.15), transparent)',
        borderRadius: side === 'left' ? '0 8px 8px 0' : '8px 0 0 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 4,
      }}>
        <span style={{
          fontSize: 24,
          color: '#60a5fa',
          fontWeight: 300,
          lineHeight: 1,
        }}>
          {side === 'left' ? '‹' : '›'}
        </span>
        {label && (
          <span style={{
            fontSize: 8,
            color: '#60a5fa',
            writingMode: 'vertical-lr',
            textOrientation: 'mixed',
            whiteSpace: 'nowrap',
            letterSpacing: 0.5,
          }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// Approximate node dimensions for bounding box calculation
const NODE_DIMS = { workPackage: { w: 240, h: 100 }, decision: { w: 210, h: 90 }, checkpoint: { w: 160, h: 72 } };

function ModuleBackgrounds({ modules, nodes, viewport }) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {modules.map((mod) => {
        const memberNodes = mod.members.map((id) => nodeMap.get(id)).filter(Boolean);
        if (memberNodes.length === 0) return null;

        // Compute bounding rect
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        memberNodes.forEach((n) => {
          const dims = NODE_DIMS[n.type] || NODE_DIMS.workPackage;
          minX = Math.min(minX, n.position.x);
          minY = Math.min(minY, n.position.y);
          maxX = Math.max(maxX, n.position.x + dims.w);
          maxY = Math.max(maxY, n.position.y + dims.h);
        });

        const pad = mod.padding || 40;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;

        // Apply viewport transform
        const left = minX * viewport.zoom + viewport.x;
        const top = minY * viewport.zoom + viewport.y;
        const width = (maxX - minX) * viewport.zoom;
        const height = (maxY - minY) * viewport.zoom;

        return (
          <div key={mod.id} style={{
            position: 'absolute',
            left, top, width, height,
            background: mod.fill || 'rgba(58,107,82,0.04)',
            border: `1px solid ${mod.stroke || '#c8c4bc'}`,
            borderRadius: 6,
          }}>
            <span style={{
              position: 'absolute',
              top: 4,
              left: 8,
              fontSize: 9,
              fontWeight: 600,
              color: mod.stroke || '#c8c4bc',
              opacity: 0.8,
              whiteSpace: 'nowrap',
            }}>
              {mod.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const megaNumberStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  fontSize: '38vw',
  fontWeight: 900,
  lineHeight: 1,
  pointerEvents: 'none',
  userSelect: 'none',
  zIndex: 0,
  transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 400ms ease',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

function MegaStageNumber({ currentStage, stageKeys }) {
  const prevStageRef = useRef(currentStage);
  const [outgoing, setOutgoing] = useState(null); // { stage, direction }
  const [incoming, setIncoming] = useState({ stage: currentStage, phase: 'idle' });
  const timeoutRef = useRef(null);

  useEffect(() => {
    const prev = prevStageRef.current;
    prevStageRef.current = currentStage;
    if (prev === currentStage) return;

    const prevIdx = stageKeys.indexOf(String(prev));
    const nextIdx = stageKeys.indexOf(String(currentStage));
    const dir = nextIdx > prevIdx ? 'right' : 'left';

    // Start outgoing animation
    setOutgoing({ stage: prev, direction: dir });
    // Start incoming animation — initially offset
    setIncoming({ stage: currentStage, phase: 'enter', direction: dir });

    // After a frame, trigger the CSS transition by switching to 'active'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIncoming((s) => ({ ...s, phase: 'active' }));
      });
    });

    // Cleanup after transition
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setOutgoing(null);
      setIncoming({ stage: currentStage, phase: 'idle' });
    }, 450);

    return () => clearTimeout(timeoutRef.current);
  }, [currentStage, stageKeys]);

  const colorIdx = parseInt(incoming.stage);
  const inColor = STAGE_COLORS[colorIdx] || '#60a5fa';

  // Incoming transform
  let inTransform = 'translate(-50%, -50%)';
  let inOpacity = 0.07;
  if (incoming.phase === 'enter') {
    const offset = incoming.direction === 'right' ? '60%' : '-60%';
    inTransform = `translate(-50%, -50%) translateX(${offset})`;
    inOpacity = 0;
  }

  return (
    <>
      {/* Outgoing number */}
      {outgoing && (() => {
        const outColorIdx = parseInt(outgoing.stage);
        const outColor = STAGE_COLORS[outColorIdx] || '#60a5fa';
        const exitX = outgoing.direction === 'right' ? '-60%' : '60%';
        return (
          <div style={{
            ...megaNumberStyle,
            transform: `translate(-50%, -50%) translateX(${exitX})`,
            color: outColor,
            opacity: 0,
          }}>
            {outgoing.stage}
          </div>
        );
      })()}

      {/* Incoming / current number */}
      <div style={{
        ...megaNumberStyle,
        transform: inTransform,
        color: inColor,
        opacity: inOpacity,
      }}>
        {incoming.stage}
      </div>
    </>
  );
}

function CanvasInner({ currentStage, setCurrentStage, addMode, setAddMode, stages }) {
  const { fitView } = useReactFlow();
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const modules = useProjectStore((s) => s.modules);
  const onNodesChange = useProjectStore((s) => s.onNodesChange);
  const onEdgesChange = useProjectStore((s) => s.onEdgesChange);
  const onConnect = useProjectStore((s) => s.onConnect);
  const addNode = useProjectStore((s) => s.addNode);
  const addNodeAndConnect = useProjectStore((s) => s.addNodeAndConnect);
  const addModule = useProjectStore((s) => s.addModule);
  const importModuleNodes = useProjectStore((s) => s.importModuleNodes);
  const selectNode = useProjectStore((s) => s.selectNode);
  const deselectNode = useProjectStore((s) => s.deselectNode);
  const readOnly = useProjectStore((s) => s.readOnly);

  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
  const wrapperRef = useRef(null);
  const connectStartRef = useRef(null);
  const stageKeys = Object.keys(stages).sort((a, b) => parseInt(a) - parseInt(b));

  // All nodes visible — current stage full, others ghosted, shift-selected outlined
  const stageNodeIds = new Set(nodes.filter((n) => n.data.stage === currentStage).map((n) => n.id));
  const styledNodes = nodes.map((n) => {
    const inStage = stageNodeIds.has(n.id);
    const isMultiSelected = selectedNodeIds.has(n.id);
    return {
      ...n,
      style: {
        ...(inStage ? {} : { opacity: 0.15, filter: 'grayscale(0.7)' }),
        ...(isMultiSelected ? { outline: '2px solid #f59e0b', outlineOffset: 3, borderRadius: 6 } : {}),
      },
      zIndex: isMultiSelected ? 20 : inStage ? 10 : 0,
    };
  });

  // Animate to stage's nodes on stage change
  useEffect(() => {
    const timer = setTimeout(() => {
      const stageNodes = nodes.filter((n) => n.data.stage === currentStage);
      if (stageNodes.length > 0) {
        fitView({ nodes: stageNodes, padding: 0.4, duration: 500 });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [currentStage, fitView]);

  const onNodeClick = useCallback((event, node) => {
    if (event.shiftKey) {
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
    } else {
      setSelectedNodeIds(new Set());
      selectNode(node.id);
    }
  }, [selectNode]);

  const onPaneClick = useCallback((event) => {
    if (addMode && !readOnly) {
      const name = prompt(`Name this ${addMode.replace(/_/g, ' ')}:`);
      if (!name || !name.trim()) { setAddMode(null); return; }
      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = {
        x: (event.clientX - bounds.left - viewport.x) / viewport.zoom,
        y: (event.clientY - bounds.top - viewport.y) / viewport.zoom,
      };
      addNode(addMode, position, currentStage, name.trim());
      setAddMode(null);
    } else {
      deselectNode();
      setSelectedNodeIds(new Set());
    }
  }, [addMode, readOnly, viewport, currentStage, addNode, deselectNode, setAddMode]);

  const onConnectStart = useCallback((_, params) => {
    connectStartRef.current = params;
  }, []);

  const onConnectEnd = useCallback((event) => {
    if (readOnly || !connectStartRef.current) return;
    const startParams = connectStartRef.current;
    connectStartRef.current = null;
    const isPane = event.target.classList?.contains('react-flow__pane');
    if (!isPane) return;
    const name = prompt('Name this work section:');
    if (!name || !name.trim()) return;
    const bounds = wrapperRef.current.getBoundingClientRect();
    const clientX = event.clientX || event.changedTouches?.[0]?.clientX || 0;
    const clientY = event.clientY || event.changedTouches?.[0]?.clientY || 0;
    const position = {
      x: (clientX - bounds.left - viewport.x) / viewport.zoom,
      y: (clientY - bounds.top - viewport.y) / viewport.zoom,
    };
    addNodeAndConnect('work_package', position, currentStage, name.trim(), startParams);
  }, [readOnly, viewport, currentStage, addNodeAndConnect]);

  // Module drop handlers
  const onDragOver = useCallback((e) => {
    if (e.dataTransfer.types.includes('application/follow-module')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onDrop = useCallback((e) => {
    if (!e.dataTransfer.types.includes('application/follow-module')) return;
    e.preventDefault();
    const mod = pendingModuleRef.current;
    if (!mod) return;
    pendingModuleRef.current = null;

    const bounds = wrapperRef.current.getBoundingClientRect();
    const dropX = (e.clientX - bounds.left - viewport.x) / viewport.zoom;
    const dropY = (e.clientY - bounds.top - viewport.y) / viewport.zoom;

    // Layout: BFS depth assignment
    const CELL_W = 300, CELL_H = 140;
    const adj = new Map();
    mod.nodes.forEach((n) => adj.set(n.id, []));
    mod.edges.forEach((edge) => {
      if (adj.has(edge.source)) adj.get(edge.source).push(edge.target);
    });

    const depths = new Map();
    const entryId = mod.entry_node || mod.nodes[0]?.id;
    if (entryId) {
      const queue = [entryId];
      depths.set(entryId, 0);
      while (queue.length) {
        const cur = queue.shift();
        for (const next of (adj.get(cur) || [])) {
          if (!depths.has(next)) {
            depths.set(next, depths.get(cur) + 1);
            queue.push(next);
          }
        }
      }
    }
    const maxD = Math.max(0, ...depths.values());
    mod.nodes.forEach((n) => { if (!depths.has(n.id)) depths.set(n.id, maxD + 1); });

    // Group by depth, assign row
    const columns = {};
    mod.nodes.forEach((n) => {
      const d = depths.get(n.id) || 0;
      if (!columns[d]) columns[d] = [];
      columns[d].push(n);
    });

    const isVert = mod.layout_direction === 'vertical';
    const positions = new Map();
    mod.nodes.forEach((n) => {
      const d = depths.get(n.id) || 0;
      const row = columns[d].indexOf(n);
      positions.set(n.id, {
        x: dropX + (isVert ? row * CELL_W : d * CELL_W),
        y: dropY + (isVert ? d * CELL_H : row * CELL_H),
      });
    });

    // Build ID mapping and nodes
    const idMap = new Map();
    mod.nodes.forEach((n) => { idMap.set(n.id, `node_${generateId()}`); });

    const buildGroups = (n) => {
      if (n.type === 'checkpoint') return [];
      if (n.type === 'decision') {
        const outputs = (n.outputs || ['Yes', 'No']).map((lbl) => ({ id: `o_${generateId()}`, label: lbl }));
        return [{ id: `g_${generateId()}`, inputLabel: 'Input', outputs }];
      }
      // work_package
      const inputLabel = n.inputs?.[0] || 'Input';
      const outputs = (n.outputs || [n.label]).map((lbl) => ({ id: `o_${generateId()}`, label: lbl }));
      return [{ id: `g_${generateId()}`, inputLabel, outputs }];
    };

    const rfType = (t) => t === 'decision' ? 'decision' : t === 'checkpoint' ? 'checkpoint' : 'workPackage';

    const newNodes = mod.nodes.map((n) => ({
      id: idMap.get(n.id),
      type: rfType(n.type),
      position: positions.get(n.id),
      data: {
        label: n.label,
        nodeType: n.type || 'work_package',
        stage: mod.stage,
        role: n.role || null,
        status: 'pending',
        notes: '',
        target_date: null,
        linked_docs: [],
        typical_inputs: [],
        groups: buildGroups(n),
        history: [{ event: 'created', timestamp: new Date().toISOString() }],
      },
    }));

    // Build edges — connect first output of source to first input of target
    const newEdges = mod.edges.map((edge) => {
      const srcId = idMap.get(edge.source);
      const tgtId = idMap.get(edge.target);
      const srcNode = newNodes.find((n) => n.id === srcId);
      const tgtNode = newNodes.find((n) => n.id === tgtId);

      let sourceHandle = 'output';
      let targetHandle = 'input';
      if (srcNode?.data.groups?.length) {
        const g = srcNode.data.groups[0];
        sourceHandle = `output-${g.id}-${g.outputs[0]?.id}`;
      }
      if (tgtNode?.data.groups?.length) {
        const g = tgtNode.data.groups[0];
        targetHandle = `input-${g.id}`;
      }

      return {
        id: `edge_${generateId()}`,
        source: srcId,
        sourceHandle,
        target: tgtId,
        targetHandle,
        type: 'deletable',
      };
    });

    const moduleRecord = {
      id: `m_${generateId()}`,
      label: mod.label,
      members: newNodes.map((n) => n.id),
      padding: 40,
      fill: 'rgba(58,107,82,0.04)',
      stroke: '#c8c4bc',
    };

    importModuleNodes(newNodes, newEdges, moduleRecord);

    // Switch to the module's stage
    if (mod.stage !== currentStage) {
      setCurrentStage(mod.stage);
    }
  }, [viewport, currentStage, setCurrentStage, importModuleNodes]);

  // Chevron navigation
  const currentIdx = stageKeys.indexOf(String(currentStage));
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < stageKeys.length - 1;
  const prevLabel = hasPrev ? `S${stageKeys[currentIdx - 1]}` : '';
  const nextLabel = hasNext ? `S${stageKeys[currentIdx + 1]}` : '';

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#1a1a2e' }}>
      {/* Mega stage number underlay — sits behind everything */}
      <MegaStageNumber currentStage={currentStage} stageKeys={stageKeys} />

      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onConnectStart={readOnly ? undefined : onConnectStart}
        onConnectEnd={readOnly ? undefined : onConnectEnd}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onViewportChange={setViewport}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        deleteKeyCode={readOnly ? null : 'Backspace'}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        style={{ background: 'transparent', zIndex: 1 }}
      >
        <Background gap={20} size={1} color="#2a2a3e" style={{ opacity: 0.5 }} />
      </ReactFlow>

      {/* Module background rectangles — behind nodes */}
      <ModuleBackgrounds modules={modules} nodes={nodes} viewport={viewport} />

      {/* Edge chevrons — appear on hover */}
      <EdgeChevron
        side="left"
        visible={hasPrev}
        label={prevLabel}
        onClick={() => hasPrev && setCurrentStage(parseInt(stageKeys[currentIdx - 1]))}
      />
      <EdgeChevron
        side="right"
        visible={hasNext}
        label={nextLabel}
        onClick={() => hasNext && setCurrentStage(parseInt(stageKeys[currentIdx + 1]))}
      />

      {/* Convert to Module button */}
      {selectedNodeIds.size >= 2 && !readOnly && (
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}>
          <button
            onClick={() => {
              const label = prompt('Module label:');
              if (!label || !label.trim()) return;
              addModule({
                id: `m_${generateId()}`,
                label: label.trim(),
                members: [...selectedNodeIds],
                padding: 40,
                fill: 'rgba(58,107,82,0.04)',
                stroke: '#c8c4bc',
              });
              setSelectedNodeIds(new Set());
            }}
            style={{
              padding: '8px 16px',
              background: '#f59e0b',
              color: '#1e1e2e',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            Group as Module ({selectedNodeIds.size} nodes)
          </button>
          <button
            onClick={() => setSelectedNodeIds(new Set())}
            style={{
              padding: '8px 12px',
              background: '#2a2a3e',
              color: '#9ca3af',
              border: '1px solid #3a3a4e',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default function Canvas() {
  const stages = useProjectStore((s) => s.project.project.stages);
  const selectedNode = useProjectStore((s) => s.selectedNode);
  const deselectNode = useProjectStore((s) => s.deselectNode);
  const readOnly = useProjectStore((s) => s.readOnly);

  const stageKeys = Object.keys(stages).sort((a, b) => parseInt(a) - parseInt(b));
  const firstAppt = stageKeys.find((k) => stages[k]?.in_appointment) || stageKeys[0] || '0';
  const [currentStage, setCurrentStage] = useState(parseInt(firstAppt));
  const [addMode, setAddMode] = useState(null);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setAddMode(null);
        deselectNode();
      }
      if (e.key === 'ArrowLeft' && !e.target.closest('input, textarea, select')) {
        setCurrentStage((prev) => {
          const idx = stageKeys.indexOf(String(prev));
          return idx > 0 ? parseInt(stageKeys[idx - 1]) : prev;
        });
      }
      if (e.key === 'ArrowRight' && !e.target.closest('input, textarea, select')) {
        setCurrentStage((prev) => {
          const idx = stageKeys.indexOf(String(prev));
          return idx < stageKeys.length - 1 ? parseInt(stageKeys[idx + 1]) : prev;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deselectNode, stageKeys]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Toolbar addMode={addMode} setAddMode={setAddMode} onFitView={() => {}} />
      <StageNav currentStage={currentStage} stages={stages} onSelect={setCurrentStage} />

      <div style={{
        position: 'absolute',
        top: 76, // 44 toolbar + 32 nav
        left: 0,
        right: (selectedNode || !readOnly) ? 300 : 0,
        bottom: 0,
        transition: 'right 0.2s ease',
      }}>
        <CanvasInner
          currentStage={currentStage}
          setCurrentStage={setCurrentStage}
          addMode={addMode}
          setAddMode={setAddMode}
          stages={stages}
        />
      </div>

      <PropertiesPanel />

      {addMode && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1e40af',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: 6,
          fontSize: 13,
          zIndex: 20,
        }}>
          Click on the canvas to place a {addMode.replace(/_/g, ' ')}. Press Esc to cancel.
        </div>
      )}
    </div>
  );
}
