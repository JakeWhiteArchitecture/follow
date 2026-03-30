import React, { useState, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { STATUS_COLORS } from '../utils/colors';
import useProjectStore from '../store/useProjectStore';

const PIN_SIZE = 8;
const DIAMOND_SIZE = 64;
const OUTPUT_ROW_H = 18;

function InlineEdit({ value, onChange, style, inputStyle: extraInputStyle }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  const startEdit = useCallback((e) => {
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
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
  const colors = STATUS_COLORS[data.status] || STATUS_COLORS.pending;
  const highlighted = useProjectStore((s) => s.highlightedNodes.has(id));
  const selectedNode = useProjectStore((s) => s.selectedNode);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const updateOutput = useProjectStore((s) => s.updateOutput);
  const readOnly = useProjectStore((s) => s.readOnly);
  const isChainGlow = highlighted && selectedNode !== id;

  // Decisions have a single group with multiple outputs (Yes/No/etc.)
  const outputs = data.groups?.[0]?.outputs || [];
  const groupId = data.groups?.[0]?.id || 'g0';

  // Layout: diamond on the left, output labels stacked on the right
  const outputAreaH = Math.max(DIAMOND_SIZE, outputs.length * OUTPUT_ROW_H + 6);
  const totalW = DIAMOND_SIZE + 90;
  const totalH = outputAreaH;

  return (
    <div style={{
      width: totalW,
      height: totalH,
      position: 'relative',
      cursor: 'grab',
    }}>
      {/* Input handle — left center of diamond */}
      <Handle type="target" position={Position.Left} id="input"
        style={{
          background: colors.border, width: PIN_SIZE, height: PIN_SIZE,
          top: totalH / 2, left: -1, borderRadius: '50%', border: '2px solid #23272f',
        }} />

      {/* Diamond shape */}
      <div style={{
        width: DIAMOND_SIZE * 0.75,
        height: DIAMOND_SIZE * 0.75,
        background: '#1e1e2e',
        border: `2px solid ${selected ? '#3b82f6' : isChainGlow ? '#60a5fa50' : colors.border}`,
        transform: 'rotate(45deg)',
        position: 'absolute',
        top: (totalH - DIAMOND_SIZE * 0.75) / 2,
        left: (DIAMOND_SIZE - DIAMOND_SIZE * 0.75) / 2,
        boxShadow: selected
          ? '0 0 0 2px #3b82f6, 0 0 20px rgba(59,130,246,0.5), 0 4px 20px rgba(0,0,0,0.5)'
          : isChainGlow
          ? '0 0 12px rgba(96,165,250,0.4), 0 4px 16px rgba(0,0,0,0.5)'
          : '0 4px 16px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)',
      }} />

      {/* Label centered on diamond */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: DIAMOND_SIZE,
        height: totalH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 8,
          fontWeight: 700,
          color: colors.border,
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: DIAMOND_SIZE * 0.6,
          wordBreak: 'break-word',
          pointerEvents: 'auto',
        }}>
          {readOnly ? data.label : (
            <InlineEdit
              value={data.label}
              onChange={(val) => updateNodeData(id, { label: val })}
              style={{ fontSize: 9, fontWeight: 700, color: colors.border }}
              inputStyle={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}
            />
          )}
        </div>
      </div>

      {/* Output labels + handles on the right */}
      <div style={{
        position: 'absolute',
        top: (totalH - outputs.length * OUTPUT_ROW_H) / 2,
        left: DIAMOND_SIZE,
        width: totalW - DIAMOND_SIZE,
      }}>
        {outputs.map((out, oi) => {
          const outY = (totalH - outputs.length * OUTPUT_ROW_H) / 2 + oi * OUTPUT_ROW_H + OUTPUT_ROW_H / 2;
          return (
            <div key={out.id} style={{
              height: OUTPUT_ROW_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: PIN_SIZE + 6,
              fontSize: 9,
              color: '#d1d5db',
            }}>
              {readOnly ? out.label : (
                <InlineEdit
                  value={out.label}
                  onChange={(val) => updateOutput(id, groupId, out.id, { label: val })}
                  style={{ fontSize: 10, color: '#d1d5db', textAlign: 'right' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Output handles */}
      {outputs.map((out, oi) => {
        const outY = (totalH - outputs.length * OUTPUT_ROW_H) / 2 + oi * OUTPUT_ROW_H + OUTPUT_ROW_H / 2;
        return (
          <Handle key={`out-${out.id}`}
            type="source" position={Position.Right}
            id={`output-${groupId}-${out.id}`}
            style={{
              top: outY, right: -1,
              background: colors.border, width: PIN_SIZE, height: PIN_SIZE,
              borderRadius: '50%', border: '2px solid #23272f',
            }}
          />
        );
      })}

      {/* Status label below */}
      <div style={{
        position: 'absolute',
        bottom: -12,
        left: 0,
        width: DIAMOND_SIZE,
        textAlign: 'center',
        fontSize: 8,
        color: '#6b7280',
        textTransform: 'uppercase',
        fontWeight: 600,
      }}>
        {data.status}
      </div>
    </div>
  );
}
