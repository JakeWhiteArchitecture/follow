import React, { useState, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { STATUS_COLORS } from '../utils/colors';
import useProjectStore from '../store/useProjectStore';

const HEADER_HEIGHT = 28;
const PIN_ROW_HEIGHT = 22;
const GROUP_DIVIDER_HEIGHT = 1;
const PIN_SIZE = 10;
const NODE_MIN_WIDTH = 220;
const ADD_ZONE_HEIGHT = 24;
const ROLE_HEIGHT = 16;

function InlineEdit({ value, onChange, style, inputStyle: extraInputStyle }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  const startEdit = useCallback((e) => {
    e.stopPropagation();
    setDraft(value);
    setEditing(true);
    // Focus after render
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

export default function WorkPackageNode({ id, data, selected }) {
  const colors = STATUS_COLORS[data.status] || STATUS_COLORS.pending;
  const contacts = useProjectStore((s) => s.project.project.contacts);
  const highlighted = useProjectStore((s) => s.highlightedNodes.has(id));
  const selectedNode = useProjectStore((s) => s.selectedNode);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const updateGroup = useProjectStore((s) => s.updateGroup);
  const updateOutput = useProjectStore((s) => s.updateOutput);
  const readOnly = useProjectStore((s) => s.readOnly);

  const contact = contacts.find((c) => c.id === data.role);
  const roleName = contact ? (contact.name || contact.discipline) : null;
  const isInfoRequest = data.nodeType === 'information_request';
  const groups = data.groups || [];

  // Calculate total height
  let contentHeight = 0;
  groups.forEach((g, gi) => {
    const rowCount = Math.max(1, g.outputs?.length || 0);
    contentHeight += rowCount * PIN_ROW_HEIGHT;
    if (gi < groups.length - 1) contentHeight += GROUP_DIVIDER_HEIGHT + 8;
  });
  if (groups.length === 0) contentHeight = PIN_ROW_HEIGHT;
  contentHeight += ADD_ZONE_HEIGHT;

  const totalHeight = HEADER_HEIGHT + ROLE_HEIGHT + contentHeight + 8;

  // Build handle positions
  let handleElements = [];
  let pinRows = [];
  let yOffset = HEADER_HEIGHT + ROLE_HEIGHT + 4;

  groups.forEach((group, gi) => {
    const outputCount = group.outputs?.length || 0;
    const rowCount = Math.max(1, outputCount);
    const groupStartY = yOffset;

    // Input pin — vertically centered within this group's rows
    const inputCenterY = groupStartY + (rowCount * PIN_ROW_HEIGHT) / 2;
    handleElements.push(
      <Handle
        key={`in-${group.id}`}
        type="target"
        position={Position.Left}
        id={`input-${group.id}`}
        style={{
          top: inputCenterY,
          left: -1,
          background: colors.border,
          width: PIN_SIZE,
          height: PIN_SIZE,
          borderRadius: '50%',
          border: '2px solid #23272f',
        }}
      />
    );

    // Input label — inline editable
    const groupId = group.id;
    pinRows.push(
      <div key={`inlabel-${group.id}`} style={{
        position: 'absolute',
        left: PIN_SIZE + 4,
        top: inputCenterY - 8,
        fontSize: 10,
        color: '#d1d5db',
        whiteSpace: 'nowrap',
        maxWidth: NODE_MIN_WIDTH / 2 - PIN_SIZE - 12,
        overflow: 'hidden',
      }}>
        {readOnly ? (
          <span>{group.inputLabel || 'Input'}</span>
        ) : (
          <InlineEdit
            value={group.inputLabel || 'Input'}
            onChange={(val) => updateGroup(id, groupId, { inputLabel: val })}
            style={{ fontSize: 10, color: '#d1d5db' }}
          />
        )}
      </div>
    );

    // Output pins
    if (outputCount > 0) {
      group.outputs.forEach((out, oi) => {
        const outY = groupStartY + oi * PIN_ROW_HEIGHT + PIN_ROW_HEIGHT / 2;
        const outId = out.id;
        handleElements.push(
          <Handle
            key={`out-${group.id}-${out.id}`}
            type="source"
            position={Position.Right}
            id={`output-${group.id}-${out.id}`}
            style={{
              top: outY,
              right: -1,
              background: colors.border,
              width: PIN_SIZE,
              height: PIN_SIZE,
              borderRadius: '50%',
              border: '2px solid #23272f',
            }}
          />
        );

        pinRows.push(
          <div key={`outlabel-${group.id}-${out.id}`} style={{
            position: 'absolute',
            right: PIN_SIZE + 4,
            top: outY - 8,
            fontSize: 10,
            color: '#d1d5db',
            whiteSpace: 'nowrap',
            textAlign: 'right',
            maxWidth: NODE_MIN_WIDTH / 2 - PIN_SIZE - 12,
            overflow: 'hidden',
          }}>
            {readOnly ? (
              <span>{out.label}</span>
            ) : (
              <InlineEdit
                value={out.label}
                onChange={(val) => updateOutput(id, groupId, outId, { label: val })}
                style={{ fontSize: 10, color: '#d1d5db', textAlign: 'right' }}
              />
            )}
          </div>
        );
      });
    }

    yOffset += rowCount * PIN_ROW_HEIGHT;

    // Group divider line
    if (gi < groups.length - 1) {
      yOffset += 4;
      pinRows.push(
        <div key={`divider-${gi}`} style={{
          position: 'absolute',
          left: 8,
          right: 8,
          top: yOffset,
          height: GROUP_DIVIDER_HEIGHT,
          background: '#374151',
        }} />
      );
      yOffset += GROUP_DIVIDER_HEIGHT + 4;
    }
  });

  // "New group" drop zone at bottom
  const dropZoneY = yOffset + 4;
  handleElements.push(
    <Handle
      key="new-group"
      type="target"
      position={Position.Left}
      id="new-group"
      style={{
        top: dropZoneY + ADD_ZONE_HEIGHT / 2,
        left: -1,
        background: 'transparent',
        width: PIN_SIZE,
        height: PIN_SIZE,
        borderRadius: '50%',
        border: '2px dashed #4b5563',
      }}
    />
  );

  return (
    <div
      style={{
        width: NODE_MIN_WIDTH,
        height: totalHeight,
        background: '#1e1e2e',
        borderRadius: 4,
        border: `2px ${isInfoRequest ? 'dashed' : 'solid'} ${selected ? '#3b82f6' : (highlighted && selectedNode !== id) ? '#60a5fa50' : '#2d2d3d'}`,
        position: 'relative',
        boxShadow: selected
          ? '0 0 0 2px #3b82f6, 0 0 20px rgba(59,130,246,0.5), 0 4px 20px rgba(0,0,0,0.5)'
          : (highlighted && selectedNode !== id)
          ? '0 0 12px rgba(96,165,250,0.4), 0 4px 16px rgba(0,0,0,0.5)'
          : '0 4px 16px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)',
        overflow: 'visible',
        cursor: 'grab',
      }}
    >
      {/* Title bar — inline editable */}
      <div style={{
        height: HEADER_HEIGHT,
        background: colors.border,
        borderRadius: '2px 2px 0 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
      }}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {readOnly ? (
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {data.label}
            </span>
          ) : (
            <InlineEdit
              value={data.label}
              onChange={(val) => updateNodeData(id, { label: val })}
              style={{
                fontSize: 11, fontWeight: 700, color: '#fff',
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
          fontSize: 8,
          color: 'rgba(255,255,255,0.7)',
          marginLeft: 4,
          textTransform: 'uppercase',
          fontWeight: 600,
          letterSpacing: '0.5px',
          flexShrink: 0,
        }}>
          {data.status}
        </span>
      </div>

      {/* Role subtitle */}
      <div style={{
        fontSize: 9,
        color: roleName ? '#6b7280' : '#ef4444',
        fontStyle: roleName ? 'normal' : 'italic',
        padding: '2px 8px 0',
        height: ROLE_HEIGHT,
        lineHeight: ROLE_HEIGHT + 'px',
      }}>
        {roleName || 'Unassigned'}
        {data.stage !== undefined && (
          <span style={{ marginLeft: 6, color: '#4b5563' }}>S{data.stage}</span>
        )}
      </div>

      {/* Pin labels (absolutely positioned) */}
      {pinRows}

      {/* Drop zone hint at bottom */}
      <div style={{
        position: 'absolute',
        bottom: 2,
        left: PIN_SIZE + 4,
        fontSize: 9,
        color: '#374151',
        fontStyle: 'italic',
      }}>
        + new input
      </div>

      {/* All handles */}
      {handleElements}
    </div>
  );
}
