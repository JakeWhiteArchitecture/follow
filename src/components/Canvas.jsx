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

function CanvasInner({ currentStage, setCurrentStage, addMode, setAddMode, stages }) {
  const { fitView, setViewport: setRFViewport } = useReactFlow();
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
  const stageKeys = Object.keys(stages).sort((a, b) => parseInt(a) - parseInt(b));

  // All nodes visible — current stage full, others ghosted
  const stageNodeIds = new Set(nodes.filter((n) => n.data.stage === currentStage).map((n) => n.id));
  const styledNodes = nodes.map((n) => ({
    ...n,
    style: stageNodeIds.has(n.id)
      ? {}
      : { opacity: 0.15, filter: 'grayscale(0.7)' },
    zIndex: stageNodeIds.has(n.id) ? 10 : 0,
  }));

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

  const onNodeClick = useCallback((_, node) => {
    selectNode(node.id);
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

  // Chevron navigation
  const currentIdx = stageKeys.indexOf(String(currentStage));
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < stageKeys.length - 1;
  const prevLabel = hasPrev ? `S${stageKeys[currentIdx - 1]}` : '';
  const nextLabel = hasNext ? `S${stageKeys[currentIdx + 1]}` : '';

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
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
        onViewportChange={setViewport}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
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
    </div>
  );
}

export default function Canvas() {
  const stages = useProjectStore((s) => s.project.project.stages);
  const selectedNode = useProjectStore((s) => s.selectedNode);
  const deselectNode = useProjectStore((s) => s.deselectNode);

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
        right: selectedNode ? 300 : 0,
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
