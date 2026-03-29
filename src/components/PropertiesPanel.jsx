import React, { useState, useRef } from 'react';
import useProjectStore from '../store/useProjectStore';
import { generateId } from '../utils/id';

const panelStyle = {
  position: 'absolute',
  top: 44,
  right: 0,
  width: 300,
  bottom: 0,
  background: '#16162a',
  borderLeft: '1px solid #2a2a3e',
  padding: 16,
  overflowY: 'auto',
  zIndex: 10,
  fontSize: 13,
  color: '#d1d5db',
};

const labelStyle = { display: 'block', fontWeight: 600, marginBottom: 4, marginTop: 12, color: '#9ca3af' };
const inputStyle = {
  width: '100%', padding: '6px 10px', border: '1px solid #3a3a4e',
  borderRadius: 4, fontSize: 13, outline: 'none', background: '#1e1e2e', color: '#d1d5db',
};
const selectStyle = { ...inputStyle, background: '#1e1e2e' };
const textareaStyle = { ...inputStyle, minHeight: 60, resize: 'vertical' };
const smallBtnStyle = {
  padding: '3px 8px', fontSize: 10, border: '1px solid #3a3a4e',
  borderRadius: 3, background: '#2a2a3e', cursor: 'pointer', color: '#d1d5db',
};
const dangerBtnStyle = { ...smallBtnStyle, color: '#ef4444', border: '1px solid #7f1d1d' };

const TYPE_COLORS = { work_package: '#f59e0b', decision: '#3b82f6', checkpoint: '#10b981' };

// Shared module ref for drag-and-drop (avoids re-render during drag)
export const pendingModuleRef = { current: null };

function MiniSchematic({ nodes, edges }) {
  // BFS to assign depth
  const adj = new Map();
  nodes.forEach((n) => adj.set(n.id, []));
  edges.forEach((e) => {
    if (adj.has(e.source)) adj.get(e.source).push(e.target);
  });

  const depths = new Map();
  const entryId = nodes[0]?.id;
  if (entryId) {
    const queue = [entryId];
    depths.set(entryId, 0);
    while (queue.length) {
      const cur = queue.shift();
      for (const next of (adj.get(cur) || [])) {
        if (!depths.has(next)) {
          depths.set(next, depths.get(cur) + 1);
          queue.push(next);
        }
      }
    }
  }
  // Assign unvisited nodes
  nodes.forEach((n) => { if (!depths.has(n.id)) depths.set(n.id, (Math.max(...depths.values()) || 0) + 1); });

  // Group by depth
  const columns = {};
  nodes.forEach((n) => {
    const d = depths.get(n.id) || 0;
    if (!columns[d]) columns[d] = [];
    columns[d].push(n);
  });

  const maxDepth = Math.max(...Object.keys(columns).map(Number), 0);
  const colW = Math.min(60, 260 / (maxDepth + 1));

  return (
    <div style={{ display: 'flex', gap: 2, minHeight: 20, overflow: 'hidden' }}>
      {Array.from({ length: maxDepth + 1 }, (_, d) => (
        <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: 2, width: colW }}>
          {(columns[d] || []).map((n) => (
            <div key={n.id} style={{
              height: 8,
              borderRadius: 2,
              background: TYPE_COLORS[n.type] || '#6b7280',
              opacity: 0.7,
              fontSize: 0,
            }} title={n.label} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ModuleImportSection() {
  const [jsonText, setJsonText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');

  const handleParse = () => {
    setError('');
    setParsed(null);
    try {
      const obj = JSON.parse(jsonText);
      const mod = obj.module || obj;
      if (!mod.label || !mod.nodes || !mod.edges) {
        setError('Missing required fields: label, nodes, edges');
        return;
      }
      if (!mod.stage && mod.stage !== 0) {
        setError('Missing required field: stage');
        return;
      }
      setParsed(mod);
    } catch {
      setError('Invalid JSON');
    }
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/follow-module', '1');
    e.dataTransfer.effectAllowed = 'copy';
    pendingModuleRef.current = parsed;
  };

  const handleClear = () => {
    setJsonText('');
    setParsed(null);
    setError('');
    pendingModuleRef.current = null;
  };

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#e5e7eb', marginBottom: 8 }}>
        Import Module
      </div>
      <textarea
        style={{
          ...inputStyle,
          minHeight: 80,
          resize: 'vertical',
          fontSize: 11,
          fontFamily: 'monospace',
          border: error ? '1px solid #ef4444' : '1px solid #3a3a4e',
        }}
        placeholder='Paste module JSON here...'
        value={jsonText}
        onChange={(e) => { setJsonText(e.target.value); setError(''); setParsed(null); }}
      />
      {error && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <button style={{ ...smallBtnStyle, flex: 1 }} onClick={handleParse}>Parse</button>
        {jsonText && <button style={{ ...smallBtnStyle }} onClick={handleClear}>Clear</button>}
      </div>

      {parsed && (
        <div
          draggable
          onDragStart={handleDragStart}
          style={{
            background: '#1e1e2e',
            border: '1px solid #3a3a4e',
            borderRadius: 6,
            padding: 12,
            cursor: 'grab',
            marginTop: 8,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: '#e5e7eb', marginBottom: 6 }}>
            {parsed.label}
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>
            Stage {parsed.stage} · {parsed.nodes.length} nodes · {parsed.edges.length} edges
          </div>
          <MiniSchematic nodes={parsed.nodes} edges={parsed.edges} />
          <div style={{ fontSize: 9, color: '#4b5563', marginTop: 8, textAlign: 'center' }}>
            Drag onto canvas to place
          </div>
        </div>
      )}
    </div>
  );
}

function NodeProperties() {
  const selectedNode = useProjectStore((s) => s.selectedNode);
  const nodes = useProjectStore((s) => s.nodes);
  const contacts = useProjectStore((s) => s.project.project.contacts);
  const updateNodeData = useProjectStore((s) => s.updateNodeData);
  const deleteNode = useProjectStore((s) => s.deleteNode);
  const deselectNode = useProjectStore((s) => s.deselectNode);
  const readOnly = useProjectStore((s) => s.readOnly);
  const addGroupToNode = useProjectStore((s) => s.addGroupToNode);
  const addOutputToGroup = useProjectStore((s) => s.addOutputToGroup);
  const updateGroup = useProjectStore((s) => s.updateGroup);
  const updateOutput = useProjectStore((s) => s.updateOutput);
  const removeGroup = useProjectStore((s) => s.removeGroup);
  const removeOutput = useProjectStore((s) => s.removeOutput);

  const node = nodes.find((n) => n.id === selectedNode);
  if (!node) return null;

  const { data } = node;
  const groups = data.groups || [];

  const update = (field, value) => {
    updateNodeData(node.id, { [field]: value });
  };

  const handleDelete = () => {
    if (confirm('Delete this node? This cannot be undone.')) {
      deleteNode(node.id);
    }
  };

  const hasGroups = data.nodeType === 'work_package' || data.nodeType === 'decision';

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 15 }}>Node Properties</strong>
        <button onClick={deselectNode}
          style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>
          &times;
        </button>
      </div>

      <label style={labelStyle}>Label</label>
      <input style={inputStyle} value={data.label}
        onChange={(e) => update('label', e.target.value)} disabled={readOnly} />

      <label style={labelStyle}>Type</label>
      <select style={selectStyle} value={data.nodeType}
        onChange={(e) => update('nodeType', e.target.value)} disabled={readOnly}>
        <option value="work_package">Work Section</option>
        <option value="decision">Decision</option>
        <option value="checkpoint">Checkpoint</option>
      </select>

      <label style={labelStyle}>Assigned Role</label>
      <select style={selectStyle} value={data.role || ''}
        onChange={(e) => update('role', e.target.value || null)} disabled={readOnly}>
        <option value="">Unassigned</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name || c.discipline}{c.org ? ` (${c.org})` : ''}
          </option>
        ))}
      </select>

      <label style={labelStyle}>Status</label>
      <select style={selectStyle} value={data.status}
        onChange={(e) => {
          if (e.target.value === 'complete' && data.status !== 'active') {
            if (!confirm('Dependencies may not be met. Mark complete anyway?')) return;
          }
          update('status', e.target.value);
        }} disabled={readOnly}>
        <option value="pending">Pending</option>
        <option value="active">Active</option>
        <option value="complete">Complete</option>
        <option value="blocked">Blocked</option>
      </select>

      {hasGroups && (
        <>
          <label style={labelStyle}>Input Groups & Pins</label>
          <div style={{ background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: 4, padding: 8 }}>
            {groups.map((group, gi) => (
              <div key={group.id} style={{
                marginBottom: gi < groups.length - 1 ? 8 : 0,
                paddingBottom: gi < groups.length - 1 ? 8 : 0,
                borderBottom: gi < groups.length - 1 ? '1px solid #2a2a3e' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#6b7280', width: 14 }}>IN</span>
                  <input
                    style={{ ...inputStyle, padding: '3px 6px', fontSize: 11, flex: 1 }}
                    value={group.inputLabel}
                    onChange={(e) => updateGroup(node.id, group.id, { inputLabel: e.target.value })}
                    disabled={readOnly}
                  />
                  {!readOnly && groups.length > 1 && (
                    <button style={dangerBtnStyle} onClick={() => removeGroup(node.id, group.id)}>&times;</button>
                  )}
                </div>
                {group.outputs.map((out) => (
                  <div key={out.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 14, marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: '#9ca3af', width: 24 }}>OUT</span>
                    <input
                      style={{ ...inputStyle, padding: '3px 6px', fontSize: 11, flex: 1 }}
                      value={out.label}
                      onChange={(e) => updateOutput(node.id, group.id, out.id, { label: e.target.value })}
                      disabled={readOnly}
                    />
                    {!readOnly && group.outputs.length > 1 && (
                      <button style={dangerBtnStyle} onClick={() => removeOutput(node.id, group.id, out.id)}>&times;</button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <button style={{ ...smallBtnStyle, marginLeft: 14, marginTop: 4 }}
                    onClick={() => addOutputToGroup(node.id, group.id)}>
                    + Add output
                  </button>
                )}
              </div>
            ))}
            {!readOnly && (
              <button style={{ ...smallBtnStyle, marginTop: 8, width: '100%' }}
                onClick={() => addGroupToNode(node.id)}>
                + Add input group
              </button>
            )}
          </div>
        </>
      )}

      <label style={labelStyle}>Notes</label>
      <textarea style={textareaStyle} value={data.notes || ''}
        onChange={(e) => update('notes', e.target.value)} disabled={readOnly} />

      <label style={labelStyle}>Target Date</label>
      <input style={inputStyle} type="date" value={data.target_date || ''}
        onChange={(e) => update('target_date', e.target.value || null)} disabled={readOnly} />

      <label style={labelStyle}>Stage</label>
      <select style={selectStyle} value={data.stage ?? ''}
        onChange={(e) => update('stage', parseInt(e.target.value))} disabled={readOnly}>
        {[0,1,2,3,4,5,6,7].map((s) => (
          <option key={s} value={s}>Stage {s}</option>
        ))}
      </select>

      {!readOnly && (
        <button onClick={handleDelete} style={{
          marginTop: 20, padding: '8px 16px',
          background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b',
          borderRadius: 4, fontSize: 12, cursor: 'pointer', width: '100%',
        }}>
          Delete Node
        </button>
      )}
    </>
  );
}

export default function PropertiesPanel() {
  const selectedNode = useProjectStore((s) => s.selectedNode);
  const readOnly = useProjectStore((s) => s.readOnly);

  // Always show panel — module import when no node selected, node props when selected
  return (
    <div style={panelStyle}>
      {selectedNode ? (
        <>
          <NodeProperties />
          {!readOnly && (
            <>
              <div style={{ borderTop: '1px solid #2a2a3e', marginTop: 16, paddingTop: 12 }} />
              <ModuleImportSection />
            </>
          )}
        </>
      ) : (
        !readOnly && <ModuleImportSection />
      )}
    </div>
  );
}
