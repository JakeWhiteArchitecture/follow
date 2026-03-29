import React, { useState, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from '@xyflow/react';
import useProjectStore from '../store/useProjectStore';

const FAN_SPREAD = 8; // pixels between fanned edges at a shared pin

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
  const readOnly = useProjectStore((s) => s.readOnly);
  const deleteEdge = useProjectStore((s) => s.deleteEdge);
  const highlighted = useProjectStore((s) => s.highlightedEdges.has(id));
  const edges = useProjectStore((s) => s.edges);

  // Compute vertical offset for edges sharing the same source or target handle
  const { srcOffset, tgtOffset } = useMemo(() => {
    // Edges sharing same source handle
    const srcSiblings = edges.filter(
      (e) => e.source === source && e.sourceHandle === sourceHandleId
    );
    const srcIdx = srcSiblings.findIndex((e) => e.id === id);
    const srcCount = srcSiblings.length;
    const srcOff = srcCount > 1 ? (srcIdx - (srcCount - 1) / 2) * FAN_SPREAD : 0;

    // Edges sharing same target handle
    const tgtSiblings = edges.filter(
      (e) => e.target === target && e.targetHandle === targetHandleId
    );
    const tgtIdx = tgtSiblings.findIndex((e) => e.id === id);
    const tgtCount = tgtSiblings.length;
    const tgtOff = tgtCount > 1 ? (tgtIdx - (tgtCount - 1) / 2) * FAN_SPREAD : 0;

    return { srcOffset: srcOff, tgtOffset: tgtOff };
  }, [edges, id, source, sourceHandleId, target, targetHandleId]);

  // Also offset the midpoint for edges that share both endpoints differently
  // to prevent parallel overlapping routes
  const routeOffset = useMemo(() => {
    // Find edges between the same two nodes (any handles)
    const parallel = edges.filter(
      (e) => (e.source === source && e.target === target) ||
             (e.source === target && e.target === source)
    );
    if (parallel.length <= 1) return 0;
    const idx = parallel.findIndex((e) => e.id === id);
    return (idx - (parallel.length - 1) / 2) * (FAN_SPREAD * 2.5);
  }, [edges, id, source, target]);

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
    offset: routeOffset,
  });

  const isGlowing = highlighted && !hovered;
  const strokeColor = hovered ? '#f87171' : isGlowing ? '#60a5fa' : (style.stroke || '#38bdf8');
  const strokeW = hovered ? 3 : isGlowing ? 3 : (style.strokeWidth || 2);

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
      {/* Invisible wider path for easier hover target */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth: strokeW,
          filter: isGlowing ? `url(#glow-${id})` : 'none',
          transition: 'stroke 0.15s, stroke-width 0.15s',
        }}
      />
      {hovered && !readOnly && (
        <EdgeLabelRenderer>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteEdge(id);
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#ef4444',
              color: '#fff',
              border: '2px solid #23272f',
              fontSize: 12,
              lineHeight: '14px',
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
        </EdgeLabelRenderer>
      )}
    </>
  );
}
