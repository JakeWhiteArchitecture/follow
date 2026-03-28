import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { STATUS_COLORS } from '../utils/colors';
import useProjectStore from '../store/useProjectStore';

const PIN_SIZE = 10;

export default function CheckpointNode({ id, data, selected }) {
  const colors = STATUS_COLORS[data.status] || STATUS_COLORS.pending;
  const highlighted = useProjectStore((s) => s.highlightedNodes.has(id));
  const selectedNode = useProjectStore((s) => s.selectedNode);
  const isChainGlow = highlighted && selectedNode !== id;

  return (
    <div style={{ position: 'relative', width: 160, height: 72 }}>
      <Handle type="target" position={Position.Left} id="input"
        style={{
          background: colors.border, width: PIN_SIZE, height: PIN_SIZE,
          top: '50%', left: -1, borderRadius: '50%', border: '2px solid #23272f',
        }} />
      <div style={{
        width: '100%',
        height: '100%',
        background: '#1e1e2e',
        border: `2px solid ${selected ? '#3b82f6' : isChainGlow ? '#60a5fa50' : colors.border}`,
        clipPath: 'polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: selected
          ? '0 0 0 2px #3b82f6, 0 0 20px rgba(59,130,246,0.5), 0 4px 20px rgba(0,0,0,0.5)'
          : isChainGlow
          ? '0 0 12px rgba(96,165,250,0.4), 0 4px 16px rgba(0,0,0,0.5)'
          : '0 4px 16px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)',
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: colors.border,
          textAlign: 'center',
          padding: '0 28px',
          lineHeight: 1.2,
        }}>
          {data.label}
        </span>
        <span style={{
          fontSize: 8,
          color: '#6b7280',
          textTransform: 'uppercase',
          fontWeight: 600,
          marginTop: 2,
        }}>
          {data.status}
        </span>
      </div>
      <Handle type="source" position={Position.Right} id="output"
        style={{
          background: colors.border, width: PIN_SIZE, height: PIN_SIZE,
          top: '50%', right: -1, borderRadius: '50%', border: '2px solid #23272f',
        }} />
    </div>
  );
}
