import React, { useState, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { TYPE_HEADER_COLORS, STATUS_ACCENT } from '../utils/colors';
import useProjectStore from '../store/useProjectStore';

const PIN_SIZE = 8;
const NODE_W = 180;
const HEADER_H = 22;
const STATUS_BAR_H = 20;
const OUTPUT_ROW_H = 18;
const PADDING = 4;

function InlineEdit({ value, onChange, style, inputStyle: extraInputStyle }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);
  const startEdit = useCallback((e) => {
    e.stopPropagation(); setDraft(value); setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [value]);
  const commit = useCallback(() => {
    setEditing(false);
    if (draft.trim() && draft !== value) onChange(draft.trim());
  }, [draft, value, onChange]);
  const onKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(false);
  }, [commit]);
  if (editing) {
    return (
      <input ref={inputRef} value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={onKeyDown}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#2d2d3d', border: '1px solid #3b82f6', borderRadius: 2,
          color: '#e5e7eb', outline: 'none', padding: '0 3px', margin: '-1px 0',
          width: '100%', ...style, ...extraInputStyle,
        }}
      />
    );
  }
  return (
    <span onDoubleClick={startEdit} style={{ cursor: 'text', ...style }} title="Double-click to edit">
      {value}
    </span>
  );
}

export default function DecisionNode({ id, data, selected }) {
  const headerColor = TYPE_HEADER_COLORS.decision;
  const statusColor = STATUS_ACCENT[data.status] || STATUS_ACCENT.pending;
  const highlighted = useProjectStore((s) => s.highlightedNodes.has(id));
  const selectedNode = useProjectStore((s) => s.selectedNode);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const updateOutput = useProjectStore((s) => s.updateOutput);
  const readOnly = useProjectStore((s) => s.readOnly);
  const isChainGlow = highlighted && selectedNode !== id;
  const flipped = data.flipped || false;
  const outputs = data.groups?.[0]?.outputs || [];
  const groupId = data.groups?.[0]?.id || 'g0';

  const outputsH = Math.max(1, outputs.length) * OUTPUT_ROW_H;
  const totalH = HEADER_H + STATUS_BAR_H + outputsH + PADDING;
  const pinAreaY = HEADER_H + STATUS_BAR_H;

  return (
    <div style={{
      width: NODE_W,
      height: totalH,
      background: '#1e1e2e',
      borderRadius: 4,
      border: `2px solid ${selected ? '#3b82f6' : isChainGlow ? '#60a5fa50' : '#2d2d3d'}`,
      position: 'relative',
      overflow: 'visible',
      cursor: 'grab',
      boxShadow: selected
        ? '0 0 0 2px #3b82f6, 0 0 20px rgba(59,130,246,0.5), 0 4px 20px rgba(0,0,0,0.5)'
        : isChainGlow
        ? '0 0 12px rgba(96,165,250,0.4), 0 4px 16px rgba(0,0,0,0.5)'
        : '0 4px 16px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)',
    }}>
      {/* Input handle */}
      <Handle type="target" position={flipped ? Position.Right : Position.Left} id="input"
        style={{
          background: headerColor, width: PIN_SIZE, height: PIN_SIZE,
          top: pinAreaY + outputsH / 2,
          [flipped ? 'right' : 'left']: -1, borderRadius: '50%', border: '2px solid #23272f',
        }} />

      {/* Row 1 — Header bar (type colour) */}
      <div style={{
        height: HEADER_H,
        background: headerColor,
        borderRadius: '2px 2px 0 0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
      }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {readOnly ? (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
            }}>{data.label}</span>
          ) : (
            <InlineEdit value={data.label}
              onChange={(val) => updateNodeData(id, { label: val })}
              style={{ fontSize: 10, fontWeight: 700, color: '#fff',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
              inputStyle={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontWeight: 700 }}
            />
          )}
        </div>
      </div>

      {/* Row 2 — Status bar */}
      <div style={{
        height: STATUS_BAR_H,
        background: '#1E293B',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: 5,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: statusColor, flexShrink: 0,
        }} />
        <span style={{
          fontSize: 10, color: statusColor, textTransform: 'uppercase',
          fontWeight: 600, letterSpacing: '0.3px',
        }}>
          {data.status}
        </span>
      </div>

      {/* ◇ type indicator in body */}
      <div style={{
        position: 'absolute',
        top: pinAreaY,
        left: 6,
        fontSize: 16,
        color: headerColor + '66',
        lineHeight: `${outputsH}px`,
        pointerEvents: 'none',
      }}>◇</div>

      {/* Output pin rows */}
      <div style={{ padding: `${PADDING / 2}px 0` }}>
        {outputs.map((out) => (
          <div key={out.id} style={{
            height: OUTPUT_ROW_H,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            paddingRight: PIN_SIZE + 4, paddingLeft: 24,
            fontSize: 9, color: '#d1d5db',
          }}>
            {readOnly ? out.label : (
              <InlineEdit value={out.label}
                onChange={(val) => updateOutput(id, groupId, out.id, { label: val })}
                style={{ fontSize: 9, color: '#d1d5db', textAlign: 'right' }} />
            )}
          </div>
        ))}
      </div>

      {/* Output handles */}
      {outputs.map((out, oi) => {
        const outY = pinAreaY + PADDING / 2 + oi * OUTPUT_ROW_H + OUTPUT_ROW_H / 2;
        return (
          <Handle key={`out-${out.id}`}
            type="source" position={flipped ? Position.Left : Position.Right}
            id={`output-${groupId}-${out.id}`}
            style={{
              top: outY, [flipped ? 'left' : 'right']: -1,
              background: headerColor, width: PIN_SIZE, height: PIN_SIZE,
              borderRadius: '50%', border: '2px solid #23272f',
            }} />
        );
      })}
    </div>
  );
}
