import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { STATUS_COLORS } from '../utils/colors';

export default function CheckpointNode({ id, data, selected }) {
  const colors = STATUS_COLORS[data.status] || STATUS_COLORS.pending;
  // Hexagon shape via clip-path
  return (
    <div style={{ position: 'relative', width: 140, height: 70 }}>
      <Handle type="target" position={Position.Left} id="input"
        style={{ background: '#6b7280', width: 8, height: 8, top: '50%' }} />
      <div style={{
        width: '100%',
        height: '100%',
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: selected ? `0 0 0 2px #3b82f6` : 'none',
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: colors.text,
          textAlign: 'center',
          padding: '0 20px',
        }}>
          {data.label}
        </span>
      </div>
      <Handle type="source" position={Position.Right} id="output"
        style={{ background: '#6b7280', width: 8, height: 8, top: '50%' }} />
    </div>
  );
}
