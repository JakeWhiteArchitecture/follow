import React, { useState, useRef } from 'react';
import useProjectStore from '../store/useProjectStore';
import { generateId } from '../utils/id';

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
const btnStyle = {
  padding: '6px 12px', fontSize: 11, border: '1px solid #3a3a4e',
  borderRadius: 4, background: '#2a2a3e', color: '#d1d5db', cursor: 'pointer',
  whiteSpace: 'nowrap', width: '100%', textAlign: 'center',
};
const activeBtnStyle = {
  ...btnStyle, background: '#3b82f6', color: '#fff', border: '1px solid #3b82f6',
};

const TYPE_COLORS = { work_package: '#f59e0b', decision: '#3b82f6', checkpoint: '#10b981' };

// Shared module ref for drag-and-drop
export const pendingModuleRef = { current: null };

function MiniSchematic({ nodes, edges }) {
  const adj = new Map();
  nodes.forEach((n) => adj.set(n.id, []));
  edges.forEach((e) => { if (adj.has(e.source)) adj.get(e.source).push(e.target); });
  const depths = new Map();
  const entryId = nodes[0]?.id;
  if (entryId) {
    const queue = [entryId];
    depths.set(entryId, 0);
    while (queue.length) {
      const cur = queue.shift();
      for (const next of (adj.get(cur) || [])) {
        if (!depths.has(next)) { depths.set(next, depths.get(cur) + 1); queue.push(next); }
      }
    }
  }
  nodes.forEach((n) => { if (!depths.has(n.id)) depths.set(n.id, (Math.max(...depths.values()) || 0) + 1); });
  const columns = {};
  nodes.forEach((n) => { const d = depths.get(n.id) || 0; if (!columns[d]) columns[d] = []; columns[d].push(n); });
  const maxDepth = Math.max(...Object.keys(columns).map(Number), 0);
  const colW = Math.min(60, 260 / (maxDepth + 1));
  return (
    <div style={{ display: 'flex', gap: 2, minHeight: 20, overflow: 'hidden' }}>
      {Array.from({ length: maxDepth + 1 }, (_, d) => (
        <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: 2, width: colW }}>
          {(columns[d] || []).map((n) => (
            <div key={n.id} style={{ height: 8, borderRadius: 2, background: TYPE_COLORS[n.type] || '#6b7280', opacity: 0.7 }} title={n.label} />
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
    setError(''); setParsed(null);
    try {
      const obj = JSON.parse(jsonText);
      const mod = obj.module || obj;
      if (!mod.label || !mod.nodes || !mod.edges) { setError('Missing: label, nodes, edges'); return; }
      // stage is optional — will be assigned from current view on drop
      setParsed(mod);
    } catch { setError('Invalid JSON'); }
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/follow-module', '1');
    e.dataTransfer.effectAllowed = 'copy';
    pendingModuleRef.current = parsed;
  };

  const handleClear = () => { setJsonText(''); setParsed(null); setError(''); pendingModuleRef.current = null; };

  const handleFileDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.name.endsWith('.json')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonText(ev.target.result);
      setError('');
      setParsed(null);
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>Import Module</div>
      <div
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={handleFileDrop}
        style={{ position: 'relative' }}
      >
        <textarea
          style={{ ...inputStyle, minHeight: 70, resize: 'vertical', fontSize: 10, fontFamily: 'monospace', border: error ? '1px solid #ef4444' : '1px solid #3a3a4e' }}
          placeholder='Paste or drop a .json file here...'
          value={jsonText}
          onChange={(e) => { setJsonText(e.target.value); setError(''); setParsed(null); }}
        />
      </div>
      {error && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 4 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <button style={{ ...smallBtnStyle, flex: 1 }} onClick={handleParse}>Parse</button>
        {jsonText && <button style={smallBtnStyle} onClick={handleClear}>Clear</button>}
      </div>
      {parsed && (
        <div draggable onDragStart={handleDragStart} style={{
          background: '#1e1e2e', border: '1px solid #3a3a4e', borderRadius: 6,
          padding: 10, cursor: 'grab', marginTop: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>{parsed.label}</div>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 6 }}>
            {parsed.stage !== undefined ? `S${parsed.stage} · ` : ''}{parsed.nodes.length} nodes · {parsed.edges.length} edges
          </div>
          <MiniSchematic nodes={parsed.nodes} edges={parsed.edges} />
          <div style={{ fontSize: 9, color: '#4b5563', marginTop: 6, textAlign: 'center' }}>Drag onto canvas</div>
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
  const update = (field, value) => updateNodeData(node.id, { [field]: value });
  const handleDelete = () => { if (confirm('Delete this node?')) deleteNode(node.id); };
  const hasGroups = data.nodeType === 'work_package' || data.nodeType === 'decision';

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <strong style={{ fontSize: 13 }}>Node Properties</strong>
        <button onClick={deselectNode}
          style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#6b7280' }}>&times;</button>
      </div>
      <label style={labelStyle}>Label</label>
      <input style={inputStyle} value={data.label} onChange={(e) => update('label', e.target.value)} disabled={readOnly} />
      <label style={labelStyle}>Type</label>
      <select style={selectStyle} value={data.nodeType} onChange={(e) => update('nodeType', e.target.value)} disabled={readOnly}>
        <option value="work_package">Work Section</option>
        <option value="decision">Decision</option>
        <option value="checkpoint">Checkpoint</option>
      </select>
      <label style={labelStyle}>Role</label>
      <select style={selectStyle} value={data.role || ''} onChange={(e) => update('role', e.target.value || null)} disabled={readOnly}>
        <option value="">Unassigned</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>{c.discipline || c.name || 'Unknown role'}</option>
        ))}
      </select>
      <label style={labelStyle}>Status</label>
      <select style={selectStyle} value={data.status} onChange={(e) => {
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
          <label style={labelStyle}>Pins</label>
          <div style={{ background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: 4, padding: 8 }}>
            {groups.map((group, gi) => {
              const isMultiInput = Array.isArray(group.inputs) && group.inputs.length > 0;
              const inputsList = isMultiInput ? group.inputs : [group.inputLabel || 'Input'];

              return (
              <div key={group.id} style={{
                marginBottom: gi < groups.length - 1 ? 8 : 0,
                paddingBottom: gi < groups.length - 1 ? 8 : 0,
                borderBottom: gi < groups.length - 1 ? '1px solid #2a2a3e' : 'none',
              }}>
                {/* Mode toggle */}
                {!readOnly && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <button style={{ ...smallBtnStyle, flex: 1, fontSize: 9, background: !isMultiInput ? '#3a3a4e' : '#2a2a3e' }}
                      onClick={() => {
                        if (isMultiInput) {
                          // Switch to single — use first input
                          updateGroup(node.id, group.id, { inputLabel: group.inputs[0] || 'Input', inputs: undefined });
                        }
                      }}>Single In</button>
                    <button style={{ ...smallBtnStyle, flex: 1, fontSize: 9, background: isMultiInput ? '#3a3a4e' : '#2a2a3e' }}
                      onClick={() => {
                        if (!isMultiInput) {
                          // Switch to multi — convert inputLabel to array
                          updateGroup(node.id, group.id, { inputs: [group.inputLabel || 'Input'], inputLabel: group.inputLabel || 'Input' });
                        }
                      }}>Multi In</button>
                  </div>
                )}

                {/* Input pins */}
                {isMultiInput ? (
                  // Multi-input: editable list
                  <>
                    {group.inputs.map((inp, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: '#6b7280', width: 14 }}>IN</span>
                        <input style={{ ...inputStyle, padding: '3px 6px', fontSize: 11, flex: 1 }}
                          value={inp}
                          onChange={(e) => {
                            const newInputs = [...group.inputs];
                            newInputs[idx] = e.target.value;
                            updateGroup(node.id, group.id, { inputs: newInputs });
                          }}
                          disabled={readOnly} />
                        {!readOnly && group.inputs.length > 1 && (
                          <button style={dangerBtnStyle} onClick={() => {
                            const newInputs = group.inputs.filter((_, i) => i !== idx);
                            updateGroup(node.id, group.id, { inputs: newInputs });
                          }}>&times;</button>
                        )}
                      </div>
                    ))}
                    {!readOnly && (
                      <button style={{ ...smallBtnStyle, marginLeft: 14, marginTop: 2 }}
                        onClick={() => updateGroup(node.id, group.id, { inputs: [...group.inputs, 'New input'] })}>+ input</button>
                    )}
                  </>
                ) : (
                  // Single input
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: '#6b7280', width: 14 }}>IN</span>
                    <input style={{ ...inputStyle, padding: '3px 6px', fontSize: 11, flex: 1 }}
                      value={group.inputLabel || ''} onChange={(e) => updateGroup(node.id, group.id, { inputLabel: e.target.value })} disabled={readOnly} />
                    {!readOnly && groups.length > 1 && (
                      <button style={dangerBtnStyle} onClick={() => removeGroup(node.id, group.id)}>&times;</button>
                    )}
                  </div>
                )}

                {/* Outputs — unchanged */}
                {group.outputs.map((out) => (
                  <div key={out.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 14, marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: '#9ca3af', width: 24 }}>OUT</span>
                    <input style={{ ...inputStyle, padding: '3px 6px', fontSize: 11, flex: 1 }}
                      value={out.label} onChange={(e) => updateOutput(node.id, group.id, out.id, { label: e.target.value })} disabled={readOnly} />
                    {!readOnly && group.outputs.length > 1 && (
                      <button style={dangerBtnStyle} onClick={() => removeOutput(node.id, group.id, out.id)}>&times;</button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <button style={{ ...smallBtnStyle, marginLeft: 14, marginTop: 4 }} onClick={() => addOutputToGroup(node.id, group.id)}>+ output</button>
                )}
              </div>
              );
            })}
            {!readOnly && (
              <button style={{ ...smallBtnStyle, marginTop: 8, width: '100%' }} onClick={() => addGroupToNode(node.id)}>+ input group</button>
            )}
          </div>
        </>
      )}
      <label style={labelStyle}>Notes</label>
      <textarea style={textareaStyle} value={data.notes || ''} onChange={(e) => update('notes', e.target.value)} disabled={readOnly} />
      <label style={labelStyle}>Target Date</label>
      <input style={inputStyle} type="date" value={data.target_date || ''} onChange={(e) => update('target_date', e.target.value || null)} disabled={readOnly} />
      <label style={labelStyle}>Stage</label>
      <select style={selectStyle} value={data.stage ?? ''} onChange={(e) => update('stage', parseInt(e.target.value))} disabled={readOnly}>
        {[0,1,2,3,4,5,6,7].map((s) => (<option key={s} value={s}>Stage {s}</option>))}
      </select>
      {!readOnly && hasGroups && (
        <button onClick={() => update('flipped', !data.flipped)} style={{
          marginTop: 12, padding: '6px 12px', background: '#2a2a3e', color: '#d1d5db',
          border: '1px solid #3a3a4e', borderRadius: 4, fontSize: 11, cursor: 'pointer', width: '100%',
        }}>{data.flipped ? 'Pins: ← In | Out →' : 'Pins: → In | Out ←'} Flip</button>
      )}
      {!readOnly && (
        <button onClick={handleDelete} style={{
          marginTop: 8, padding: '6px 12px', background: '#7f1d1d', color: '#fca5a5',
          border: '1px solid #991b1b', borderRadius: 4, fontSize: 11, cursor: 'pointer', width: '100%',
        }}>Delete Node</button>
      )}
    </>
  );
}

function ModulesList() {
  const modules = useProjectStore((s) => s.modules);
  const nodes = useProjectStore((s) => s.nodes);
  const updateModule = useProjectStore((s) => s.updateModule);
  const deleteModule = useProjectStore((s) => s.deleteModule);
  const selectNode = useProjectStore((s) => s.selectNode);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');

  if (modules.length === 0) return null;

  const startEdit = (mod) => {
    setEditingId(mod.id);
    setEditLabel(mod.label);
  };

  const commitEdit = () => {
    if (editLabel.trim() && editingId) {
      updateModule(editingId, { label: editLabel.trim() });
    }
    setEditingId(null);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Modules ({modules.length})
      </div>
      {modules.map((mod) => {
        const memberCount = mod.members.filter((id) => nodes.find((n) => n.id === id)).length;
        return (
          <div key={mod.id} style={{
            background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: 4,
            padding: '5px 8px', marginBottom: 3, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
            onClick={() => {
              // Select the first member to navigate to it
              const firstMember = mod.members.find((id) => nodes.find((n) => n.id === id));
              if (firstMember) selectNode(firstMember);
            }}
          >
            <div style={{
              width: 4, height: 20, borderRadius: 2,
              background: mod.stroke || '#c8c4bc', flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingId === mod.id ? (
                <input
                  autoFocus
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ ...inputStyle, padding: '1px 4px', fontSize: 10 }}
                />
              ) : (
                <div
                  onDoubleClick={(e) => { e.stopPropagation(); startEdit(mod); }}
                  style={{
                    fontSize: 10, fontWeight: 600, color: '#d1d5db',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title="Double-click to rename"
                >
                  {mod.label}
                </div>
              )}
              <div style={{ fontSize: 8, color: '#4b5563' }}>{memberCount} nodes</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete module "${mod.label}"? Nodes will remain.`)) deleteModule(mod.id);
              }}
              style={{ background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 12, padding: 0 }}
              title="Delete module"
            >×</button>
          </div>
        );
      })}
    </div>
  );
}

function UnassignedNodesList() {
  const nodes = useProjectStore((s) => s.nodes);
  const selectNode = useProjectStore((s) => s.selectNode);
  const [expanded, setExpanded] = useState({});

  const unassigned = nodes.filter((n) => !n.data.role);
  const byType = {
    checkpoint: unassigned.filter((n) => n.data.nodeType === 'checkpoint'),
    decision: unassigned.filter((n) => n.data.nodeType === 'decision'),
    work_package: unassigned.filter((n) => n.data.nodeType === 'work_package'),
  };

  const typeLabels = { checkpoint: 'Checkpoints', decision: 'Decisions', work_package: 'Work Sections' };
  const typeColors = { checkpoint: '#7C3AED', decision: '#DB2777', work_package: '#EA580C' };

  if (unassigned.length === 0) return (
    <div style={{ fontSize: 10, color: '#4b5563', textAlign: 'center', padding: 8 }}>All nodes assigned</div>
  );

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Unassigned ({unassigned.length})
      </div>
      {Object.entries(byType).map(([type, items]) => {
        if (items.length === 0) return null;
        const isOpen = expanded[type];
        return (
          <div key={type} style={{ marginBottom: 4 }}>
            <button onClick={() => setExpanded((e) => ({ ...e, [type]: !e[type] }))}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
                fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 0', width: '100%',
              }}>
              <span style={{ fontSize: 8, color: typeColors[type] }}>●</span>
              <span>{typeLabels[type]}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#ef4444', fontWeight: 600 }}>{items.length}</span>
              <span style={{ fontSize: 8, color: '#4b5563' }}>{isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && items.map((n) => (
              <button key={n.id} onClick={() => selectNode(n.id)}
                style={{
                  background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: 3,
                  color: '#d1d5db', fontSize: 10, padding: '3px 8px', marginBottom: 2,
                  cursor: 'pointer', width: '100%', textAlign: 'left',
                  display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                {n.data.label}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SettingsSection() {
  const sidebarSide = useProjectStore((s) => s.sidebarSide);
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderTop: '1px solid #2a2a3e', marginTop: 12, paddingTop: 8 }}>
      <button onClick={() => setOpen(!open)} style={{
        background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280',
        fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, padding: 0, width: '100%',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
        Settings
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          <label style={{ ...labelStyle, marginTop: 4 }}>Sidebar Position</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={sidebarSide === 'left' ? activeBtnStyle : btnStyle}
              onClick={() => useProjectStore.setState({ sidebarSide: 'left' })}>Left</button>
            <button style={sidebarSide === 'right' ? activeBtnStyle : btnStyle}
              onClick={() => useProjectStore.setState({ sidebarSide: 'right' })}>Right</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PropertiesPanel({ addMode, setAddMode }) {
  const selectedNode = useProjectStore((s) => s.selectedNode);
  const readOnly = useProjectStore((s) => s.readOnly);
  const sidebarSide = useProjectStore((s) => s.sidebarSide);
  const exportProject = useProjectStore((s) => s.exportProject);
  const project = useProjectStore((s) => s.project);

  const handleExport = () => {
    const data = exportProject();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.project?.name || 'threadwork-project'}.json`.replace(/\s+/g, '-').toLowerCase();
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try { useProjectStore.getState().loadProject(JSON.parse(ev.target.result)); }
        catch { alert('Invalid JSON file.'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const nodeTypes = [
    { key: 'work_package', label: 'Work Section' },
    { key: 'decision', label: 'Decision' },
    { key: 'checkpoint', label: 'Checkpoint' },
  ];

  const isLeft = sidebarSide === 'left';

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      [isLeft ? 'left' : 'right']: 0,
      width: 280,
      bottom: 0,
      background: '#16162a',
      [isLeft ? 'borderRight' : 'borderLeft']: '1px solid #2a2a3e',
      padding: '12px 12px',
      overflowY: 'auto',
      zIndex: 10,
      fontSize: 13,
      color: '#d1d5db',
    }}>
      {/* Brand */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#e5e7eb', letterSpacing: '-0.5px' }}>Threadwork</div>
        <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>
          {project.project?.name || 'Untitled project'}
        </div>
      </div>

      {/* Add node buttons */}
      {!readOnly && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Add</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {nodeTypes.map((nt) => (
              <button key={nt.key}
                style={addMode === nt.key ? { ...activeBtnStyle, width: 'auto', flex: 1 } : { ...btnStyle, width: 'auto', flex: 1 }}
                onClick={() => setAddMode(addMode === nt.key ? null : nt.key)}
              >+ {nt.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* File operations */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {!readOnly && <button style={btnStyle} onClick={handleImport}>Import</button>}
        <button style={btnStyle} onClick={handleExport}>Export</button>
      </div>

      <div style={{ borderTop: '1px solid #2a2a3e', marginBottom: 12 }} />

      {/* Node properties or module import */}
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
        <>
          <ModulesList />
          <UnassignedNodesList />
          {!readOnly && (
            <>
              <div style={{ borderTop: '1px solid #2a2a3e', marginTop: 12, paddingTop: 12 }} />
              <ModuleImportSection />
            </>
          )}
        </>
      )}

      {/* Settings */}
      <SettingsSection />
    </div>
  );
}
