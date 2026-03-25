import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { STATUS_COLORS } from '../utils/colors';

export default function MilestoneNode({ id, data, selected }) {
  const colors = STATUS_COLORS[data.status] || STATUS_COLORS.pending;

  return (
    <div style={{ position: 'relative', width: 80, height: 80 }}>
      <Handle type="target" position={Position.Left} id="input"
        style={{ background: '#6b7280', width: 8, height: 8, top: '50%' }} />
      <div style={{
        width: 56,
        height: 56,
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        transform: 'rotate(45deg)',
        position: 'absolute',
        top: 12,
        left: 12,
        boxShadow: selected ? `0 0 0 2px #3b82f6` : '0 1px 3px rgba(0,0,0,0.1)',
      }} />
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: 10,
        fontWeight: 600,
        color: colors.text,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}>
        {data.label}
      </div>
      <Handle type="source" position={Position.Right} id="output"
        style={{ background: '#6b7280', width: 8, height: 8, top: '50%' }} />
    </div>
  );
}
