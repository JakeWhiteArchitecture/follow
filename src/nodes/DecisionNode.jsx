import React, { useState, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { TYPE_HEADER_COLORS, STATUS_ACCENT } from '../utils/colors';
import useProjectStore from '../store/useProjectStore';

const PIN_SIZE = 8;
const DIAMOND_W = 48;
const PANEL_W = 160;
const TOTAL_W = DIAMOND_W + PANEL_W;
const HEADER_H = 22;
const OUTPUT_ROW_H = 18;
const PADDING = 4;

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
  const headerColor = TYPE_HEADER_COLORS.decision;
  const accentColor = STATUS_ACCENT[data.status] || STATUS_ACCENT.pending;
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
  const totalH = HEADER_H + outputsH + PADDING;
  const diamondSize = totalH * 0.6; // diamond scales with height

  return (
    <div style={{
      width: TOTAL_W,
      height: totalH,
      position: 'relative',
      cursor: 'grab',
      display: 'flex',
      flexDirection: flipped ? 'row-reverse' : 'row',
    }}>
      {/* Status accent bar — left edge of diamond */}
      <div style={{
        position: 'absolute',
        [flipped ? 'right' : 'left']: 0,
        top: 0,
        bottom: 0,
        width: 4,
        background: accentColor,
        borderRadius: flipped ? '0 2px 2px 0' : '2px 0 0 2px',
        zIndex: 2,
      }} />

      {/* Diamond section */}
      <div style={{
        width: DIAMOND_W,
        height: totalH,
        position: 'relative',
        flexShrink: 0,
      }}>
        {/* Input handle — left point of diamond */}
        <Handle type="target" position={flipped ? Position.Right : Position.Left} id="input"
          style={{
            background: accentColor, width: PIN_SIZE, height: PIN_SIZE,
            top: '50%', [flipped ? 'right' : 'left']: -1, borderRadius: '50%', border: '2px solid #23272f',
          }} />

        {/* Diamond shape */}
        <div style={{
          width: diamondSize,
          height: diamondSize,
          background: '#1e1e2e',
          border: `2px solid ${selected ? '#3b82f6' : isChainGlow ? '#60a5fa50' : headerColor}`,
          transform: 'rotate(45deg)',
          position: 'absolute',
          top: (totalH - diamondSize) / 2,
          left: (DIAMOND_W - diamondSize) / 2,
          boxShadow: selected
            ? '0 0 0 2px #3b82f6, 0 0 20px rgba(59,130,246,0.5), 0 4px 20px rgba(0,0,0,0.5)'
            : isChainGlow
            ? '0 0 12px rgba(96,165,250,0.4), 0 4px 16px rgba(0,0,0,0.5)'
            : '0 4px 16px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)',
          zIndex: 1,
        }} />
      </div>

      {/* Panel section — flush against diamond */}
      <div style={{
        width: PANEL_W,
        height: totalH,
        background: '#1e1e2e',
        borderRadius: flipped ? '4px 0 0 4px' : '0 4px 4px 0',
        border: `2px solid ${selected ? '#3b82f6' : isChainGlow ? '#60a5fa50' : '#2d2d3d'}`,
        [flipped ? 'borderRight' : 'borderLeft']: 'none',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: selected
          ? '0 0 0 2px #3b82f6, 0 0 20px rgba(59,130,246,0.5), 0 4px 20px rgba(0,0,0,0.5)'
          : isChainGlow
          ? '0 0 12px rgba(96,165,250,0.4), 0 4px 16px rgba(0,0,0,0.5)'
          : '0 4px 16px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)',
      }}>
        {/* Header bar */}
        <div style={{
          height: HEADER_H,
          background: headerColor,
          borderRadius: flipped ? '2px 0 0 0' : '0 2px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 6px',
        }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {readOnly ? (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#fff',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                display: 'block',
              }}>
                {data.label}
              </span>
            ) : (
              <InlineEdit
                value={data.label}
                onChange={(val) => updateNodeData(id, { label: val })}
                style={{
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'block',
                }}
                inputStyle={{
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff', fontWeight: 700,
                }}
              />
            )}
          </div>
          {/* Status chip */}
          <span style={{
            fontSize: 7,
            color: accentColor,
            background: accentColor + '40',
            padding: '1px 5px',
            borderRadius: 3,
            textTransform: 'uppercase',
            fontWeight: 700,
            flexShrink: 0,
            marginLeft: 3,
            letterSpacing: '0.3px',
          }}>
            {data.status}
          </span>
        </div>

        {/* Output pins */}
        <div style={{ padding: `${PADDING / 2}px 0` }}>
          {outputs.map((out) => (
            <div key={out.id} style={{
              height: OUTPUT_ROW_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: PIN_SIZE + 4,
              paddingLeft: 6,
              fontSize: 9,
              color: '#d1d5db',
            }}>
              {readOnly ? out.label : (
                <InlineEdit
                  value={out.label}
                  onChange={(val) => updateOutput(id, groupId, out.id, { label: val })}
                  style={{ fontSize: 9, color: '#d1d5db', textAlign: 'right' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Output handles — on right edge of panel */}
      {outputs.map((out, oi) => {
        const outY = HEADER_H + PADDING / 2 + oi * OUTPUT_ROW_H + OUTPUT_ROW_H / 2;
        return (
          <Handle key={`out-${out.id}`}
            type="source" position={flipped ? Position.Left : Position.Right}
            id={`output-${groupId}-${out.id}`}
            style={{
              top: outY, [flipped ? 'left' : 'right']: -1,
              background: accentColor, width: PIN_SIZE, height: PIN_SIZE,
              borderRadius: '50%', border: '2px solid #23272f',
            }}
          />
        );
      })}
    </div>
  );
}
