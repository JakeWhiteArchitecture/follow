import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { STATUS_COLORS } from '../utils/colors';
import useProjectStore from '../store/useProjectStore';

export default function WorkPackageNode({ id, data, selected }) {
  const colors = STATUS_COLORS[data.status] || STATUS_COLORS.pending;
  const contacts = useProjectStore((s) => s.project.project.contacts);
  const contact = contacts.find((c) => c.id === data.role);
  const roleName = contact ? (contact.name || contact.discipline) : null;
  const isInfoRequest = data.nodeType === 'information_request';

  return (
    <div
      style={{
        background: colors.bg,
        border: `2px ${isInfoRequest ? 'dashed' : 'solid'} ${colors.border}`,
        borderRadius: 6,
        padding: '8px 12px',
        minWidth: 160,
        maxWidth: 220,
        cursor: 'grab',
        boxShadow: selected ? `0 0 0 2px #3b82f6` : '0 1px 3px rgba(0,0,0,0.1)',
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Left} id="input"
        style={{ background: '#6b7280', width: 8, height: 8 }} />
      <div style={{ fontWeight: 600, color: colors.text, marginBottom: 4, lineHeight: 1.3 }}>
        {data.label}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
        <span style={{
          fontSize: 10,
          color: roleName ? '#374151' : '#ef4444',
          fontStyle: roleName ? 'normal' : 'italic',
          borderBottom: roleName ? 'none' : '1px dotted #ef4444',
        }}>
          {roleName || 'Unassigned'}
        </span>
        <span style={{
          fontSize: 9,
          background: colors.border,
          color: '#fff',
          padding: '1px 5px',
          borderRadius: 3,
          textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          {data.status}
        </span>
      </div>
      {data.stage !== undefined && (
        <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>
          Stage {data.stage}
        </div>
      )}
      <Handle type="source" position={Position.Right} id="output"
        style={{ background: '#6b7280', width: 8, height: 8 }} />
    </div>
  );
}
