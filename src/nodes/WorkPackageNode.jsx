import React, { useState, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { STATUS_COLORS, TYPE_HEADER_COLORS, STATUS_ACCENT } from '../utils/colors';
import useProjectStore from '../store/useProjectStore';

const PIN_SIZE = 8;
const NODE_MIN_WIDTH = 180;

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
    if (draft.trim() && draft !== value) {
      onChange(draft.trim());
    }
  }, [draft, value, onChange]);

  const onKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { commit(); }
    if (e.key === 'Escape') { setEditing(false); }
  }, [commit]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#2d2d3d',
          border: '1px solid #3b82f6',
          borderRadius: 2,
          color: '#e5e7eb',
          outline: 'none',
          padding: '0 3px',
          margin: '-1px 0',
          width: '100%',
          ...style,
          ...extraInputStyle,
        }}
      />
    );
  }

  return (
    <span
      onDoubleClick={startEdit}
      style={{ cursor: 'text', ...style }}
      title="Double-click to edit"
    >
      {value}
    </span>
  );
}

function PinGroup({ nodeId, group, colors, readOnly, isLast, flipped }) {
  const updateGroup = useProjectStore((s) => s.updateGroup);
  const updateOutput = useProjectStore((s) => s.updateOutput);

  const outputs = group.outputs || [];
  const rowCount = Math.max(1, outputs.length);

  return (
    <div style={{
      borderBottom: isLast ? 'none' : '1px solid #374151',
      padding: '4px 0',
    }}>
      <div style={{ display: 'flex', flexDirection: flipped ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
        {/* Input side */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: rowCount * 18,
          paddingLeft: flipped ? 6 : PIN_SIZE + 4,
          paddingRight: flipped ? PIN_SIZE + 4 : 6,
          textAlign: flipped ? 'right' : 'left',
        }}>
          <div style={{
            fontSize: 9,
            color: '#d1d5db',
            lineHeight: 1.3,
            wordBreak: 'break-word',
          }}>
            {readOnly ? (
              <span>{group.inputLabel || 'Input'}</span>
            ) : (
              <InlineEdit
                value={group.inputLabel || 'Input'}
                onChange={(val) => updateGroup(nodeId, group.id, { inputLabel: val })}
                style={{ fontSize: 10, color: '#d1d5db' }}
              />
            )}
          </div>
        </div>

        {/* Output side */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          paddingRight: flipped ? 6 : PIN_SIZE + 6,
          paddingLeft: flipped ? PIN_SIZE + 6 : 8,
        }}>
          {outputs.map((out) => (
            <div key={out.id} style={{
              fontSize: 10,
              color: '#d1d5db',
              textAlign: flipped ? 'left' : 'right',
              lineHeight: 1.3,
              wordBreak: 'break-word',
              minHeight: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: flipped ? 'flex-start' : 'flex-end',
            }}>
              {readOnly ? (
                <span>{out.label}</span>
              ) : (
                <InlineEdit
                  value={out.label}
                  onChange={(val) => updateOutput(nodeId, group.id, out.id, { label: val })}
                  style={{ fontSize: 10, color: '#d1d5db', textAlign: 'right' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Handles are rendered by the parent — we just return layout info */}
    </div>
  );
}

export default function WorkPackageNode({ id, data, selected }) {
  const colors = STATUS_COLORS[data.status] || STATUS_COLORS.pending;
  const headerColor = TYPE_HEADER_COLORS.work_package;
  const accentColor = STATUS_ACCENT[data.status] || STATUS_ACCENT.pending;
  const contacts = useProjectStore((s) => s.project.project.contacts);
  const highlighted = useProjectStore((s) => s.highlightedNodes.has(id));
  const selectedNode = useProjectStore((s) => s.selectedNode);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const readOnly = useProjectStore((s) => s.readOnly);

  const contact = contacts.find((c) => c.id === data.role);
  const roleName = contact ? (contact.name || contact.discipline) : null;
  const isInfoRequest = data.nodeType === 'information_request';
  const groups = data.groups || [];
  const isChainGlow = highlighted && selectedNode !== id;
  const flipped = data.flipped || false;
  const inputPos = flipped ? Position.Right : Position.Left;
  const outputPos = flipped ? Position.Left : Position.Right;

  // We use a ref-based approach to measure and position handles after render.
  // Since React Flow handles need to be in the render tree, we calculate
  // positions based on the flex layout using estimated row heights.
  const nodeRef = useRef(null);

  // Build handle elements — we need to estimate positions for React Flow handles
  // Each group: input handle centered vertically, output handles per row
  let handleElements = [];
  let yOffset = 0; // track cumulative offset within the pin area

  const [nodeHovered, setNodeHovered] = useState(false);
  const headerH = 22;
  const roleH = 14;
  const groupPadding = 6;
  const outputRowH = 18;
  const dividerH = 1;

  let pinAreaY = headerH + roleH;

  groups.forEach((group, gi) => {
    const outputCount = Math.max(1, group.outputs?.length || 0);
    const groupContentH = outputCount * outputRowH;
    const groupTotalH = groupContentH + groupPadding;

    // Input pin — centered vertically in this group
    const inputCenterY = pinAreaY + groupPadding / 2 + groupContentH / 2;
    handleElements.push(
      <Handle
        key={`in-${group.id}`}
        type="target"
        position={inputPos}
        id={`input-${group.id}`}
        style={{
          top: inputCenterY,
          [flipped ? 'right' : 'left']: -1,
          background: accentColor,
          width: PIN_SIZE,
          height: PIN_SIZE,
          borderRadius: '50%',
          border: '2px solid #23272f',
        }}
      />
    );

    // Output pins
    if (group.outputs) {
      group.outputs.forEach((out, oi) => {
        const outY = pinAreaY + groupPadding / 2 + oi * outputRowH + outputRowH / 2;
        handleElements.push(
          <Handle
            key={`out-${group.id}-${out.id}`}
            type="source"
            position={outputPos}
            id={`output-${group.id}-${out.id}`}
            style={{
              top: outY,
              [flipped ? 'left' : 'right']: -1,
              background: accentColor,
              width: PIN_SIZE,
              height: PIN_SIZE,
              borderRadius: '50%',
              border: '2px solid #23272f',
            }}
          />
        );
      });
    }

    pinAreaY += groupTotalH;
    if (gi < groups.length - 1) pinAreaY += dividerH;
  });

  // "New group" drop zone — only visible on hover
  const addZoneH = nodeHovered ? 20 : 4;
  if (nodeHovered) {
    handleElements.push(
      <Handle
        key="new-group"
        type="target"
        position={inputPos}
        id="new-group"
        style={{
          top: pinAreaY + addZoneH / 2,
          [flipped ? 'right' : 'left']: -1,
          background: 'transparent',
          width: PIN_SIZE,
          height: PIN_SIZE,
          borderRadius: '50%',
          border: '2px dashed #4b5563',
        }}
      />
    );
  }

  return (
    <div
      ref={nodeRef}
      onMouseEnter={() => setNodeHovered(true)}
      onMouseLeave={() => setNodeHovered(false)}
      style={{
        width: NODE_MIN_WIDTH,
        background: '#1e1e2e',
        borderRadius: 4,
        border: `2px ${isInfoRequest ? 'dashed' : 'solid'} ${selected ? '#3b82f6' : isChainGlow ? '#60a5fa50' : '#2d2d3d'}`,
        position: 'relative',
        boxShadow: selected
          ? '0 0 0 2px #3b82f6, 0 0 20px rgba(59,130,246,0.5), 0 4px 20px rgba(0,0,0,0.5)'
          : isChainGlow
          ? '0 0 12px rgba(96,165,250,0.4), 0 4px 16px rgba(0,0,0,0.5)'
          : '0 4px 16px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)',
        overflow: 'visible',
        cursor: 'grab',
      }}
    >
      {/* Status accent bar — left edge */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        background: accentColor,
        borderRadius: '2px 0 0 2px',
        zIndex: 2,
      }} />

      {/* Title bar — type-coloured */}
      <div style={{
        height: headerH,
        background: headerColor,
        borderRadius: '2px 2px 0 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
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
        <span style={{
          fontSize: 7,
          color: accentColor,
          background: accentColor + '40',
          padding: '1px 5px',
          borderRadius: 3,
          marginLeft: 3,
          textTransform: 'uppercase',
          fontWeight: 700,
          flexShrink: 0,
          letterSpacing: '0.3px',
        }}>
          {data.status}
        </span>
      </div>

      {/* Role + stage subtitle */}
      <div style={{
        fontSize: 8,
        color: roleName ? '#6b7280' : '#ef4444',
        fontStyle: roleName ? 'normal' : 'italic',
        padding: '1px 6px 0',
        height: roleH,
        lineHeight: roleH + 'px',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      }}>
        {roleName || 'Unassigned'}
        {data.stage !== undefined && (
          <span style={{ marginLeft: 4, color: '#3a3a4e', fontSize: 7 }}>S{data.stage}</span>
        )}
      </div>

      {/* Pin groups — flow layout */}
      <div>
        {groups.map((group, gi) => (
          <PinGroup
            key={group.id}
            nodeId={id}
            group={group}
            colors={colors}
            readOnly={readOnly}
            isLast={gi === groups.length - 1}
            flipped={flipped}
          />
        ))}
      </div>

      {/* Drop zone hint — hover only */}
      <div style={{
        height: addZoneH,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: PIN_SIZE + 6,
        fontSize: 8,
        color: '#374151',
        fontStyle: 'italic',
        overflow: 'hidden',
      }}>
        {nodeHovered && '+ new input'}
      </div>

      {/* All handles */}
      {handleElements}
    </div>
  );
}
