import React, { useState } from 'react';
import useProjectStore from '../store/useProjectStore';

const btnStyle = {
  padding: '6px 12px',
  fontSize: 12,
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const activeBtnStyle = {
  ...btnStyle,
  background: '#1e40af',
  color: '#fff',
  border: '1px solid #1e40af',
};

export default function Toolbar({ addMode, setAddMode, onFitView }) {
  const exportProject = useProjectStore((s) => s.exportProject);
  const project = useProjectStore((s) => s.project);
  const readOnly = useProjectStore((s) => s.readOnly);

  const handleExport = () => {
    const data = exportProject();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.project?.name || 'follow-project'}.json`.replace(/\s+/g, '-').toLowerCase();
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
        try {
          const json = JSON.parse(ev.target.result);
          useProjectStore.getState().loadProject(json);
        } catch {
          alert('Invalid JSON file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const nodeTypes = [
    { key: 'work_package', label: 'Work Package' },
    { key: 'information_request', label: 'Info Request' },
    { key: 'milestone', label: 'Milestone' },
    { key: 'user_checkpoint', label: 'Checkpoint' },
  ];

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 44,
      background: '#fff',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      gap: 6,
      zIndex: 10,
    }}>
      <span style={{ fontWeight: 700, fontSize: 15, marginRight: 8 }}>follow</span>
      <span style={{ fontSize: 12, color: '#6b7280', marginRight: 16 }}>
        {project.project?.name || 'Untitled'}
      </span>

      {!readOnly && (
        <>
          <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />
          {nodeTypes.map((nt) => (
            <button
              key={nt.key}
              style={addMode === nt.key ? activeBtnStyle : btnStyle}
              onClick={() => setAddMode(addMode === nt.key ? null : nt.key)}
            >
              + {nt.label}
            </button>
          ))}
          <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />
        </>
      )}

      <button style={btnStyle} onClick={onFitView}>Fit View</button>

      <div style={{ flex: 1 }} />

      {!readOnly && (
        <button style={btnStyle} onClick={handleImport}>Import</button>
      )}
      <button style={btnStyle} onClick={handleExport}>Export JSON</button>
    </div>
  );
}
