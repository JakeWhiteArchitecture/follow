import React, { useState } from 'react';
import { RIBA_STAGES } from '../store/useProjectStore';

const styles = {
  container: {
    maxWidth: 640,
    margin: '40px auto',
    padding: '32px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 32 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4, color: '#374151' },
  input: {
    width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
    borderRadius: 6, fontSize: 14, marginBottom: 16, outline: 'none',
  },
  section: { marginBottom: 24 },
  stageRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
    fontSize: 13,
  },
  contactRow: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8,
  },
  smallInput: {
    padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4,
    fontSize: 13, outline: 'none',
  },
  btn: {
    background: '#1e40af', color: '#fff', border: 'none', padding: '10px 24px',
    borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  addBtn: {
    background: 'none', border: '1px dashed #9ca3af', padding: '6px 12px',
    borderRadius: 4, fontSize: 12, color: '#6b7280', cursor: 'pointer',
  },
  importBtn: {
    background: 'none', border: '1px solid #d1d5db', padding: '10px 24px',
    borderRadius: 6, fontSize: 14, cursor: 'pointer', marginLeft: 8,
  },
};

export default function SetupScreen({ onInit, onImport }) {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [address, setAddress] = useState('');
  const [selectedStages, setSelectedStages] = useState(['0', '1', '2', '3', '4']);
  const [contacts, setContacts] = useState([{ name: '', org: '', discipline: '' }]);

  const toggleStage = (key) => {
    setSelectedStages((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const updateContact = (idx, field, value) => {
    setContacts((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const addContact = () => {
    setContacts((prev) => [...prev, { name: '', org: '', discipline: '' }]);
  };

  const handleSubmit = () => {
    if (!name.trim()) { alert('Project name is required.'); return; }
    onInit({
      name: name.trim(),
      client: client.trim(),
      address: address.trim(),
      activeStages: RIBA_STAGES.map((s) => s.key), // all stages exist
      appointmentStages: selectedStages,
      contacts,
    });
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
          onImport(json);
        } catch {
          alert('Invalid JSON file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div style={styles.container}>
      <div style={styles.title}>Threadwork</div>
      <div style={styles.subtitle}>Follow the golden thread. Create a new project or import an existing one.</div>

      <div style={styles.section}>
        <label style={styles.label}>Project Name</label>
        <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Smith Rear Extension" />

        <label style={styles.label}>Client</label>
        <input style={styles.input} value={client} onChange={(e) => setClient(e.target.value)}
          placeholder="e.g. Mr & Mrs Smith" />

        <label style={styles.label}>Project Address</label>
        <input style={styles.input} value={address} onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 14 Acacia Avenue, Haywards Heath" />
      </div>

      <div style={styles.section}>
        <label style={styles.label}>RIBA Stages in Appointment</label>
        {RIBA_STAGES.map((s) => (
          <div key={s.key} style={styles.stageRow}>
            <input
              type="checkbox"
              checked={selectedStages.includes(s.key)}
              onChange={() => toggleStage(s.key)}
            />
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Project Contacts</label>
        {contacts.map((c, i) => (
          <div key={i} style={styles.contactRow}>
            <input style={styles.smallInput} placeholder="Name"
              value={c.name} onChange={(e) => updateContact(i, 'name', e.target.value)} />
            <input style={styles.smallInput} placeholder="Organisation"
              value={c.org} onChange={(e) => updateContact(i, 'org', e.target.value)} />
            <input style={styles.smallInput} placeholder="Discipline / Role"
              value={c.discipline} onChange={(e) => updateContact(i, 'discipline', e.target.value)} />
          </div>
        ))}
        <button style={styles.addBtn} onClick={addContact}>+ Add contact</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button style={styles.btn} onClick={handleSubmit}>Create Project</button>
        <button style={styles.importBtn} onClick={handleImport}>Import JSON</button>
      </div>
    </div>
  );
}
