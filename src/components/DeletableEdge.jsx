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

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
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
          stroke: hovered ? '#f87171' : (style.stroke || '#38bdf8'),
          strokeWidth: hovered ? 3 : (style.strokeWidth || 2),
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
