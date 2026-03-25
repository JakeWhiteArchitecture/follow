import React from 'react';
import { RIBA_STAGES, getStageColumns } from '../store/useProjectStore';
import { STAGE_COLORS } from '../utils/colors';

export default function StageColumns({ stages }) {
  const columns = getStageColumns(stages);

  return (
    <>
      {columns.map((col) => {
        const stage = RIBA_STAGES.find((s) => s.key === col.key);
        const inAppointment = col.inAppointment;
        const colorIdx = parseInt(col.key);

        return (
          <div
            key={col.key}
            style={{
              position: 'absolute',
              left: col.x,
              top: 0,
              width: col.width,
              height: 4000,
              background: inAppointment ? STAGE_COLORS[colorIdx] + '40' : '#f3f4f620',
              borderRight: '1px dashed #d1d5db',
              pointerEvents: 'none',
              opacity: inAppointment ? 1 : 0.5,
            }}
          />
        );
      })}
    </>
  );
}

export function StickyHeaders({ stages, transform }) {
  const columns = getStageColumns(stages);
  // Calculate visible offset based on viewport transform
  // transform = { x, y, zoom } from React Flow viewport

  return (
    <div style={{
      position: 'absolute',
      top: 44,
      left: 0,
      right: 0,
      height: 28,
      background: '#fff',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      zIndex: 9,
      overflow: 'hidden',
    }}>
      {columns.map((col) => {
        const stage = RIBA_STAGES.find((s) => s.key === col.key);
        const inAppointment = col.inAppointment;
        const colorIdx = parseInt(col.key);
        const screenX = col.x * (transform?.zoom || 1) + (transform?.x || 0);
        const screenW = col.width * (transform?.zoom || 1);

        return (
          <div
            key={col.key}
            style={{
              position: 'absolute',
              left: screenX,
              width: screenW,
              height: 28,
              background: inAppointment ? STAGE_COLORS[colorIdx] : '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 600,
              color: inAppointment ? '#374151' : '#9ca3af',
              borderRight: '1px solid #e5e7eb',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: '0 4px',
              opacity: inAppointment ? 1 : 0.6,
            }}
          >
            {stage?.label || `Stage ${col.key}`}
            {!inAppointment && <span style={{ marginLeft: 4, fontSize: 9, fontStyle: 'italic' }}>(outside appointment)</span>}
          </div>
        );
      })}
    </div>
  );
}
