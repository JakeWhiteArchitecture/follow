import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { STATUS_COLORS } from '../utils/colors';

const PIN_SIZE = 10;

export default function MilestoneNode({ id, data, selected }) {
  const colors = STATUS_COLORS[data.status] || STATUS_COLORS.pending;

  return (
    <div style={{ position: 'relative', width: 100, height: 100 }}>
      <Handle type="target" position={Position.Left} id="input"
        style={{
          background: colors.border, width: PIN_SIZE, height: PIN_SIZE,
          top: '50%', left: -1, borderRadius: '50%', border: '2px solid #23272f',
        }} />
      <div style={{
        width: 70,
        height: 70,
        background: '#1e1e2e',
        border: `2px solid ${selected ? '#3b82f6' : colors.border}`,
        transform: 'rotate(45deg)',
        position: 'absolute',
        top: 15,
        left: 15,
        boxShadow: selected ? '0 0 0 1px #3b82f6' : '0 2px 8px rgba(0,0,0,0.3)',
      }} />
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: 10,
        fontWeight: 700,
        color: colors.border,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        maxWidth: 60,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {data.label}
      </div>
      <div style={{
        position: 'absolute',
        bottom: -2,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 8,
        color: '#6b7280',
        textTransform: 'uppercase',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}>
        {data.status}
      </div>
      <Handle type="source" position={Position.Right} id="output"
        style={{
          background: colors.border, width: PIN_SIZE, height: PIN_SIZE,
          top: '50%', right: -1, borderRadius: '50%', border: '2px solid #23272f',
        }} />
    </div>
  );
}
