import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from '@xyflow/react';
import useProjectStore from '../store/useProjectStore';

const FAN_SPREAD = 10;

export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  sourceHandleId,
  target,
  targetHandleId,
  style = {},
  markerEnd,
}) {
  const [hovered, setHovered] = useState(false);
  const [handleHovered, setHandleHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef(null);
  const readOnly = useProjectStore((s) => s.readOnly);
  const deleteEdge = useProjectStore((s) => s.deleteEdge);
  const setEdgeOffset = useProjectStore((s) => s.setEdgeOffset);
  const highlighted = useProjectStore((s) => s.highlightedEdges.has(id));
  const edges = useProjectStore((s) => s.edges);
  const edgeOffset = useProjectStore((s) => s.edgeOffsets[id] || 0);
  const currentStage = useProjectStore((s) => s.currentStage);
  const nodes = useProjectStore((s) => s.nodes);

  // Stage focus
  const sourceNode = useMemo(() => nodes.find((n) => n.id === source), [nodes, source]);
  const targetNode = useMemo(() => nodes.find((n) => n.id === target), [nodes, target]);
  const srcInStage = sourceNode?.data?.stage === currentStage;
  const tgtInStage = targetNode?.data?.stage === currentStage;
  const neitherInStage = !srcInStage && !tgtInStage;
  const isCrossStage = (srcInStage && !tgtInStage) || (!srcInStage && tgtInStage);

  // Pin fan offset for shared handles
  const { srcOffset, tgtOffset } = useMemo(() => {
    const srcSiblings = edges.filter(
      (e) => e.source === source && e.sourceHandle === sourceHandleId
    );
    const srcIdx = srcSiblings.findIndex((e) => e.id === id);
    const srcCount = srcSiblings.length;
    const srcOff = srcCount > 1 ? (srcIdx - (srcCount - 1) / 2) * FAN_SPREAD : 0;

    const tgtSiblings = edges.filter(
      (e) => e.target === target && e.targetHandle === targetHandleId
    );
    const tgtIdx = tgtSiblings.findIndex((e) => e.id === id);
    const tgtCount = tgtSiblings.length;
    const tgtOff = tgtCount > 1 ? (tgtIdx - (tgtCount - 1) / 2) * FAN_SPREAD : 0;

    return { srcOffset: srcOff, tgtOffset: tgtOff };
  }, [edges, id, source, sourceHandleId, target, targetHandleId]);

  const adjustedSourceY = sourceY + srcOffset;
  const adjustedTargetY = targetY + tgtOffset;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY: adjustedSourceY,
    targetX,
    targetY: adjustedTargetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
    offset: edgeOffset,
  });

  // Drag the midpoint handle to adjust offset
  const onHandleMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startOffset = useProjectStore.getState().edgeOffsets[id] || 0;

    const onMouseMove = (me) => {
      const dx = me.clientX - startX;
      const zoom = useProjectStore.getState().canvasZoom || 1;
      useProjectStore.getState().setEdgeOffset(id, startOffset + dx / zoom);
    };

    const onMouseUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [id, edgeOffset, setEdgeOffset]);

  const isGlowing = highlighted && !hovered;
  let baseStroke = style.stroke || '#38bdf8';
  let edgeOpacity = 1;

  if (neitherInStage) {
    edgeOpacity = 0.08;
  } else if (isCrossStage) {
    edgeOpacity = 0.35;
  }

  const strokeColor = hovered ? '#f87171' : isGlowing ? '#60a5fa' : baseStroke;
  const strokeW = hovered ? 3 : isGlowing ? 3 : (style.strokeWidth || 2);

  const gradientId = `edge-grad-${id}`;
  const needsGradient = isCrossStage && !hovered && !isGlowing;
  const isInFocus = !neitherInStage;
  const showControls = (hovered || handleHovered || dragging) && !readOnly && isInFocus;

  return (
    <>
      {isGlowing && (
        <defs>
          <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      {needsGradient && (
        <defs>
          <linearGradient id={gradientId}
            x1={srcInStage ? '0%' : '100%'} y1="0%"
            x2={srcInStage ? '100%' : '0%'} y2="0%"
          >
            <stop offset="0%" stopColor={baseStroke} stopOpacity="1" />
            <stop offset="5%" stopColor={baseStroke} stopOpacity="0.8" />
            <stop offset="30%" stopColor={baseStroke} stopOpacity="0.2" />
            <stop offset="70%" stopColor={baseStroke} stopOpacity="0.08" />
            <stop offset="100%" stopColor={baseStroke} stopOpacity="0.03" />
          </linearGradient>
        </defs>
      )}
      {/* Invisible wider path for hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { if (!dragging) setHovered(false); }}
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: needsGradient ? `url(#${gradientId})` : strokeColor,
          strokeWidth: strokeW,
          opacity: needsGradient ? 1 : edgeOpacity,
          filter: isGlowing ? `url(#glow-${id})` : 'none',
          transition: 'opacity 500ms ease, stroke 0.15s, stroke-width 0.15s',
        }}
      />
      {/* Midpoint handle — always visible on in-focus edges, enlarges on hover */}
      {isInFocus && !readOnly && (
        <EdgeLabelRenderer>
          {/* Drag handle — small dot always visible, grows on hover */}
          <div
            onMouseDown={onHandleMouseDown}
            onMouseEnter={() => { setHandleHovered(true); setHovered(true); }}
            onMouseLeave={() => { if (!dragging) { setHandleHovered(false); setHovered(false); } }}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              width: showControls ? 16 : 8,
              height: showControls ? 16 : 8,
              borderRadius: '50%',
              background: dragging ? '#60a5fa' : showControls ? '#2a2a3e' : '#3a3a4e',
              border: showControls ? '2px solid #60a5fa' : '1px solid #4a4a5e',
              cursor: 'ew-resize',
              zIndex: 5,
              transition: 'width 0.15s, height 0.15s, background 0.15s, border 0.15s',
              opacity: showControls ? 1 : 0.6,
            }}
            title="Drag to offset edge route"
          />
          {/* Delete button — only on hover, above the handle */}
          {showControls && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteEdge(id);
              }}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 20}px)`,
                pointerEvents: 'all',
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: '#ef4444',
                color: '#fff',
                border: '2px solid #23272f',
                fontSize: 10,
                lineHeight: '10px',
                textAlign: 'center',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
              title="Remove connection"
            >
              ×
            </button>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}
