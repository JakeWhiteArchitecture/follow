import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  useReactFlow,
  useViewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import useProjectStore, { getStageColumns, getStageForPosition } from '../store/useProjectStore';
import WorkPackageNode from '../nodes/WorkPackageNode';
import MilestoneNode from '../nodes/MilestoneNode';
import CheckpointNode from '../nodes/CheckpointNode';
import Toolbar from './Toolbar';
import PropertiesPanel from './PropertiesPanel';
import DeletableEdge from './DeletableEdge';
import { StickyHeaders } from './StageColumns';
import { STAGE_COLORS } from '../utils/colors';

const nodeTypes = {
  workPackage: WorkPackageNode,
  infoRequest: WorkPackageNode,
  milestone: MilestoneNode,
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

export default function Canvas() {
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const onNodesChange = useProjectStore((s) => s.onNodesChange);
  const onEdgesChange = useProjectStore((s) => s.onEdgesChange);
  const onConnect = useProjectStore((s) => s.onConnect);
  const addNode = useProjectStore((s) => s.addNode);
  const selectNode = useProjectStore((s) => s.selectNode);
  const deselectNode = useProjectStore((s) => s.deselectNode);
  const selectedNode = useProjectStore((s) => s.selectedNode);
  const stages = useProjectStore((s) => s.project.project.stages);
  const readOnly = useProjectStore((s) => s.readOnly);

  const [addMode, setAddMode] = useState(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const reactFlowWrapper = useRef(null);

  // Escape key to cancel add mode
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setAddMode(null);
        deselectNode();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deselectNode]);

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

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: (event.clientX - bounds.left - viewport.x) / viewport.zoom,
        y: (event.clientY - bounds.top - 72 - viewport.y) / viewport.zoom,
      };

      const stageColumns = getStageColumns(stages);
      const stage = getStageForPosition(position.x, stageColumns);

      addNode(addMode, position, stage, name.trim());
      setAddMode(null);
    } else {
      deselectNode();
    }
  }, [addMode, readOnly, viewport, stages, addNode, deselectNode, setAddMode]);

  const handleFitView = useCallback(() => {
    // will be set by ReactFlow
  }, []);

  // Generate stage background elements as React Flow nodes wouldn't work well
  // We'll use the Background slots approach
  const stageColumns = getStageColumns(stages);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }} ref={reactFlowWrapper}>
      <Toolbar addMode={addMode} setAddMode={setAddMode} onFitView={() => {}} />
      <StickyHeaders stages={stages} transform={viewport} />

      <div style={{
        position: 'absolute',
        top: 72, // 44 + 28
        left: 0,
        right: selectedNode ? 300 : 0,
        bottom: 0,
        transition: 'right 0.2s ease',
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onViewportChange={setViewport}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          snapToGrid
          snapGrid={[10, 10]}
          deleteKeyCode={readOnly ? null : 'Backspace'}
          selectionKeyCode={readOnly ? null : 'Shift'}
          multiSelectionKeyCode="Shift"
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable
          style={{ background: '#fafafa' }}
        >
          <Background gap={20} size={1} color="#e5e7eb" />
          {/* Stage column backgrounds rendered as SVG overlay */}
          <StageBackgrounds columns={stageColumns} />
        </ReactFlow>
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

function StageBackgrounds({ columns }) {
  const viewport = useViewport();

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      {columns.map((col) => {
        const colorIdx = parseInt(col.key);
        const screenX = col.x * viewport.zoom + viewport.x;
        const screenW = col.width * viewport.zoom;

        return (
          <rect
            key={col.key}
            x={screenX}
            y={0}
            width={screenW}
            height="100%"
            fill={col.inAppointment ? STAGE_COLORS[colorIdx] : '#f3f4f6'}
            opacity={col.inAppointment ? 0.15 : 0.08}
          />
        );
      })}
      {/* Dashed column dividers */}
      {columns.map((col) => {
        const screenX = (col.x + col.width) * viewport.zoom + viewport.x;
        return (
          <line
            key={`div-${col.key}`}
            x1={screenX}
            y1={0}
            x2={screenX}
            y2="100%"
            stroke="#d1d5db"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        );
      })}
    </svg>
  );
}
