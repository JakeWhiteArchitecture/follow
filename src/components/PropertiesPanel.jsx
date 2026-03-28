import React from 'react';
import useProjectStore from '../store/useProjectStore';

const panelStyle = {
  position: 'absolute',
  top: 44,
  right: 0,
  width: 300,
  bottom: 0,
  background: '#fff',
  borderLeft: '1px solid #e5e7eb',
  padding: 16,
  overflowY: 'auto',
  zIndex: 10,
  fontSize: 13,
};

const labelStyle = { display: 'block', fontWeight: 600, marginBottom: 4, marginTop: 12, color: '#374151' };
const inputStyle = {
  width: '100%', padding: '6px 10px', border: '1px solid #d1d5db',
  borderRadius: 4, fontSize: 13, outline: 'none',
};
const selectStyle = { ...inputStyle, background: '#fff' };
const textareaStyle = { ...inputStyle, minHeight: 60, resize: 'vertical' };
const smallBtnStyle = {
  padding: '3px 8px', fontSize: 10, border: '1px solid #d1d5db',
  borderRadius: 3, background: '#fff', cursor: 'pointer', color: '#374151',
};
const dangerBtnStyle = { ...smallBtnStyle, color: '#ef4444', border: '1px solid #fca5a5' };

export default function PropertiesPanel() {
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

  const hasGroups = data.nodeType === 'work_package' || data.nodeType === 'information_request';

  return (
    <div style={panelStyle}>
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
        <option value="work_package">Work Package</option>
        <option value="information_request">Information Request</option>
        <option value="milestone">Milestone</option>
        <option value="user_checkpoint">User Checkpoint</option>
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

      {/* Groups / Pins editor */}
      {hasGroups && (
        <>
          <label style={labelStyle}>Input Groups & Pins</label>
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, padding: 8 }}>
            {groups.map((group, gi) => (
              <div key={group.id} style={{
                marginBottom: gi < groups.length - 1 ? 8 : 0,
                paddingBottom: gi < groups.length - 1 ? 8 : 0,
                borderBottom: gi < groups.length - 1 ? '1px solid #e5e7eb' : 'none',
              }}>
                {/* Group input label */}
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

                {/* Outputs */}
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

                {/* Add output button */}
                {!readOnly && (
                  <button style={{ ...smallBtnStyle, marginLeft: 14, marginTop: 4 }}
                    onClick={() => addOutputToGroup(node.id, group.id)}>
                    + Add output
                  </button>
                )}
              </div>
            ))}

            {/* Add group button */}
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
      <div style={{ ...inputStyle, background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' }}>
        {data.stage !== undefined ? `Stage ${data.stage}` : 'Unknown'}
        <span style={{ fontSize: 10, marginLeft: 8 }}>(drag node to change)</span>
      </div>

      {!readOnly && (
        <button onClick={handleDelete} style={{
          marginTop: 20,
          padding: '8px 16px',
          background: '#fee2e2',
          color: '#991b1b',
          border: '1px solid #fca5a5',
          borderRadius: 4,
          fontSize: 12,
          cursor: 'pointer',
          width: '100%',
        }}>
          Delete Node
        </button>
      )}
    </div>
  );
}
