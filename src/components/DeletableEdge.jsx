import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from '@xyflow/react';
import useProjectStore from '../store/useProjectStore';

export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}) {
  const [hovered, setHovered] = useState(false);
  const readOnly = useProjectStore((s) => s.readOnly);
  const deleteEdge = useProjectStore((s) => s.deleteEdge);
  const highlighted = useProjectStore((s) => s.highlightedEdges.has(id));

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const isGlowing = highlighted && !hovered;
  const strokeColor = hovered ? '#f87171' : isGlowing ? '#60a5fa' : (style.stroke || '#38bdf8');
  const strokeW = hovered ? 3 : isGlowing ? 3 : (style.strokeWidth || 2);

  return (
    <>
      {/* Glow filter for highlighted edges */}
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
