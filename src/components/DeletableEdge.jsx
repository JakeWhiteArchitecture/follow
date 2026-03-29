import React, { useState, useMemo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from '@xyflow/react';
import useProjectStore from '../store/useProjectStore';

const FAN_SPREAD = 10;
const ROUTE_SPREAD = 30; // vertical segment offset for parallel routes

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
  const currentStage = useProjectStore((s) => s.currentStage);
  const nodes = useProjectStore((s) => s.nodes);

  // Determine if source/target are in the current stage
  const sourceNode = useMemo(() => nodes.find((n) => n.id === source), [nodes, source]);
  const targetNode = useMemo(() => nodes.find((n) => n.id === target), [nodes, target]);
  const srcInStage = sourceNode?.data?.stage === currentStage;
  const tgtInStage = targetNode?.data?.stage === currentStage;
  const bothInStage = srcInStage && tgtInStage;
  const neitherInStage = !srcInStage && !tgtInStage;
  const isCrossStage = (srcInStage && !tgtInStage) || (!srcInStage && tgtInStage);

  // Compute vertical offset for edges sharing the same source or target handle
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

  // Offset the vertical segment for edges that would overlap
  // Group edges that share a source node OR target node — their vertical
  // segments tend to land at similar X positions
  const routeOffset = useMemo(() => {
    // Find all edges leaving the same source node (any handle)
    const fromSameSource = edges.filter((e) => e.source === source);
    if (fromSameSource.length <= 1) return 0;
    const idx = fromSameSource.findIndex((e) => e.id === id);
    return (idx - (fromSameSource.length - 1) / 2) * ROUTE_SPREAD;
  }, [edges, id, source]);

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

  // Determine stroke colour and opacity based on stage focus
  let baseStroke = style.stroke || '#38bdf8';
  let edgeOpacity = 1;

  if (neitherInStage) {
    edgeOpacity = 0.08;
  } else if (isCrossStage) {
    edgeOpacity = 0.35;
  }

  const strokeColor = hovered ? '#f87171' : isGlowing ? '#60a5fa' : baseStroke;
  const strokeW = hovered ? 3 : isGlowing ? 3 : (style.strokeWidth || 2);

  // Unique gradient ID for cross-stage fade
  const gradientId = `edge-grad-${id}`;
  const needsGradient = isCrossStage && !hovered && !isGlowing;

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
          stroke: needsGradient ? `url(#${gradientId})` : strokeColor,
          strokeWidth: strokeW,
          opacity: needsGradient ? 1 : edgeOpacity,
          filter: isGlowing ? `url(#glow-${id})` : 'none',
          transition: 'opacity 500ms ease, stroke 0.15s, stroke-width 0.15s',
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
