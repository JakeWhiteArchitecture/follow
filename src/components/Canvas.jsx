import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import useProjectStore, { RIBA_STAGES } from '../store/useProjectStore';
import WorkPackageNode from '../nodes/WorkPackageNode';
import DecisionNode from '../nodes/DecisionNode';
import CheckpointNode from '../nodes/CheckpointNode';
import Toolbar from './Toolbar';
import PropertiesPanel from './PropertiesPanel';
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

function StageNav({ currentStage, stages, onPrev, onNext, onSelect }) {
  const stageKeys = Object.keys(stages).sort((a, b) => parseInt(a) - parseInt(b));
  const currentIdx = stageKeys.indexOf(String(currentStage));
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < stageKeys.length - 1;
  const stageInfo = RIBA_STAGES.find((s) => s.key === String(currentStage));
  const inAppointment = stages[String(currentStage)]?.in_appointment;
  const colorIdx = parseInt(currentStage);

  return (
    <div style={{
      position: 'absolute',
      top: 44,
      left: 0,
      right: 0,
      height: 36,
      background: '#16162a',
      borderBottom: '1px solid #2a2a3e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9,
      gap: 0,
    }}>
      {/* Prev button */}
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        style={{
          background: 'none', border: 'none', color: hasPrev ? '#d1d5db' : '#3a3a4e',
          fontSize: 18, cursor: hasPrev ? 'pointer' : 'default', padding: '0 12px',
          fontWeight: 700, lineHeight: 1,
        }}
        title={hasPrev ? `Stage ${stageKeys[currentIdx - 1]}` : ''}
      >
        ‹
      </button>

      {/* Stage dots */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', margin: '0 8px' }}>
        {stageKeys.map((key) => {
          const isActive = key === String(currentStage);
          const isInAppt = stages[key]?.in_appointment;
          const ci = parseInt(key);
          return (
            <button
              key={key}
              onClick={() => onSelect(parseInt(key))}
              style={{
                width: isActive ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: isActive ? (STAGE_COLORS[ci] || '#60a5fa') : isInAppt ? '#3a3a4e' : '#252538',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                padding: 0,
              }}
              title={RIBA_STAGES.find((s) => s.key === key)?.label || `Stage ${key}`}
            />
          );
        })}
      </div>

      {/* Next button */}
      <button
        onClick={onNext}
        disabled={!hasNext}
        style={{
          background: 'none', border: 'none', color: hasNext ? '#d1d5db' : '#3a3a4e',
          fontSize: 18, cursor: hasNext ? 'pointer' : 'default', padding: '0 12px',
          fontWeight: 700, lineHeight: 1,
        }}
        title={hasNext ? `Stage ${stageKeys[currentIdx + 1]}` : ''}
      >
        ›
      </button>

      {/* Stage label */}
      <div style={{
        position: 'absolute',
        left: 12,
        fontSize: 11,
        fontWeight: 600,
        color: inAppointment ? (STAGE_COLORS[colorIdx] || '#d1d5db') : '#6b7280',
        opacity: inAppointment ? 1 : 0.6,
      }}>
        {stageInfo?.label || `Stage ${currentStage}`}
        {!inAppointment && <span style={{ marginLeft: 6, fontSize: 9, fontStyle: 'italic' }}>outside appointment</span>}
      </div>

      {/* Node count */}
      <StageNodeCount currentStage={currentStage} />
    </div>
  );
}

function StageNodeCount({ currentStage }) {
  const nodes = useProjectStore((s) => s.nodes);
  const count = nodes.filter((n) => n.data.stage === currentStage).length;
  return (
    <div style={{
      position: 'absolute',
      right: 12,
      fontSize: 10,
      color: '#6b7280',
    }}>
      {count} node{count !== 1 ? 's' : ''}
    </div>
  );
}

// Indicators for off-screen edges going to other stages
function CrossStageIndicators({ currentStage, nodes, edges }) {
  const stageNodes = nodes.filter((n) => n.data.stage === currentStage);
  const stageNodeIds = new Set(stageNodes.map((n) => n.id));
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Find edges that cross into/out of this stage
  const leftLinks = new Set();
  const rightLinks = new Set();

  edges.forEach((e) => {
    const srcInStage = stageNodeIds.has(e.source);
    const tgtInStage = stageNodeIds.has(e.target);
    if (srcInStage && !tgtInStage) {
      const tgt = nodeMap.get(e.target);
      if (tgt) rightLinks.add(`→ S${tgt.data.stage}: ${tgt.data.label}`);
    }
    if (!srcInStage && tgtInStage) {
      const src = nodeMap.get(e.source);
      if (src) leftLinks.add(`S${src.data.stage}: ${src.data.label} →`);
    }
  });

  return (
    <>
      {leftLinks.size > 0 && (
        <div style={{
          position: 'absolute', top: 80 + 16, left: 8, zIndex: 5,
          background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: 4,
          padding: '6px 10px', fontSize: 9, color: '#6b7280', maxWidth: 180,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2, color: '#9ca3af' }}>From earlier stages</div>
          {[...leftLinks].map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {rightLinks.size > 0 && (
        <div style={{
          position: 'absolute', top: 80 + 16, right: 8, zIndex: 5,
          background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: 4,
          padding: '6px 10px', fontSize: 9, color: '#6b7280', maxWidth: 180,
          textAlign: 'right',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2, color: '#9ca3af' }}>To later stages</div>
          {[...rightLinks].map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </>
  );
}

function CanvasInner({ currentStage, addMode, setAddMode }) {
  const { fitView } = useReactFlow();
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const onNodesChange = useProjectStore((s) => s.onNodesChange);
  const onEdgesChange = useProjectStore((s) => s.onEdgesChange);
  const onConnect = useProjectStore((s) => s.onConnect);
  const addNode = useProjectStore((s) => s.addNode);
  const addNodeAndConnect = useProjectStore((s) => s.addNodeAndConnect);
  const selectNode = useProjectStore((s) => s.selectNode);
  const deselectNode = useProjectStore((s) => s.deselectNode);
  const readOnly = useProjectStore((s) => s.readOnly);

  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const wrapperRef = useRef(null);
  const connectStartRef = useRef(null);

  // Filter: show nodes on current stage + connected nodes from other stages (dimmed)
  const stageNodeIds = new Set(nodes.filter((n) => n.data.stage === currentStage).map((n) => n.id));

  // Find nodes from other stages that have edges to/from this stage's nodes
  const connectedOtherStage = new Set();
  edges.forEach((e) => {
    if (stageNodeIds.has(e.source) && !stageNodeIds.has(e.target)) connectedOtherStage.add(e.target);
    if (stageNodeIds.has(e.target) && !stageNodeIds.has(e.source)) connectedOtherStage.add(e.source);
  });

  const visibleNodeIds = new Set([...stageNodeIds, ...connectedOtherStage]);
  const visibleNodes = nodes
    .filter((n) => visibleNodeIds.has(n.id))
    .map((n) => ({
      ...n,
      style: stageNodeIds.has(n.id) ? {} : { opacity: 0.3, pointerEvents: 'none' },
    }));

  const visibleEdges = edges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));

  // Fit view when stage changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const stageNodes = nodes.filter((n) => n.data.stage === currentStage);
      if (stageNodes.length > 0) {
        fitView({ nodes: stageNodes, padding: 0.3, duration: 400 });
      } else {
        fitView({ padding: 0.5, duration: 400 });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [currentStage, fitView]);

  const onNodeClick = useCallback((_, node) => {
    selectNode(node.id);
  }, [selectNode]);

  const onPaneClick = useCallback((event) => {
    if (addMode && !readOnly) {
      const name = prompt(`Name this ${addMode.replace(/_/g, ' ')}:`);
      if (!name || !name.trim()) {
        setAddMode(null);
        return;
      }

      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = {
        x: (event.clientX - bounds.left - viewport.x) / viewport.zoom,
        y: (event.clientY - bounds.top - viewport.y) / viewport.zoom,
      };

      addNode(addMode, position, currentStage, name.trim());
      setAddMode(null);
    } else {
      deselectNode();
    }
  }, [addMode, readOnly, viewport, currentStage, addNode, deselectNode, setAddMode]);

  const onConnectStart = useCallback((event, params) => {
    connectStartRef.current = params;
  }, []);

  const onConnectEnd = useCallback((event) => {
    if (readOnly || !connectStartRef.current) return;
    const startParams = connectStartRef.current;
    connectStartRef.current = null;

    const targetElement = event.target;
    const isPane = targetElement.classList?.contains('react-flow__pane');
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

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onConnectStart={readOnly ? undefined : onConnectStart}
        onConnectEnd={readOnly ? undefined : onConnectEnd}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onViewportChange={setViewport}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        snapToGrid
        snapGrid={[20, 20]}
        deleteKeyCode={readOnly ? null : 'Backspace'}
        selectionKeyCode={readOnly ? null : 'Shift'}
        multiSelectionKeyCode="Shift"
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        style={{ background: '#1a1a2e' }}
      >
        <Background gap={20} size={1} color="#2a2a3e" />
      </ReactFlow>
    </div>
  );
}

export default function Canvas() {
  const stages = useProjectStore((s) => s.project.project.stages);
  const selectedNode = useProjectStore((s) => s.selectedNode);
  const deselectNode = useProjectStore((s) => s.deselectNode);
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);

  const stageKeys = Object.keys(stages).sort((a, b) => parseInt(a) - parseInt(b));
  // Default to first in-appointment stage
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

  const goPrev = useCallback(() => {
    setCurrentStage((prev) => {
      const idx = stageKeys.indexOf(String(prev));
      return idx > 0 ? parseInt(stageKeys[idx - 1]) : prev;
    });
  }, [stageKeys]);

  const goNext = useCallback(() => {
    setCurrentStage((prev) => {
      const idx = stageKeys.indexOf(String(prev));
      return idx < stageKeys.length - 1 ? parseInt(stageKeys[idx + 1]) : prev;
    });
  }, [stageKeys]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Toolbar addMode={addMode} setAddMode={setAddMode} onFitView={() => {}} />
      <StageNav
        currentStage={currentStage}
        stages={stages}
        onPrev={goPrev}
        onNext={goNext}
        onSelect={setCurrentStage}
      />

      <div style={{
        position: 'absolute',
        top: 80, // 44 toolbar + 36 stage nav
        left: 0,
        right: selectedNode ? 300 : 0,
        bottom: 0,
        transition: 'right 0.2s ease',
      }}>
        <CanvasInner
          currentStage={currentStage}
          addMode={addMode}
          setAddMode={setAddMode}
        />
        <CrossStageIndicators currentStage={currentStage} nodes={nodes} edges={edges} />
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
