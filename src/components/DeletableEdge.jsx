import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
} from '@xyflow/react';
import useProjectStore from '../store/useProjectStore';

const FAN_SPREAD = 10;

export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  source,
  sourceHandleId,
  target,
  targetHandleId,
  style = {},
  markerEnd,
  data,
}) {
  const isLoop = data?.loop === true;
  const [hovered, setHovered] = useState(false);
  const [handleHovered, setHandleHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef(null);
  const readOnly = useProjectStore((s) => s.readOnly);
  const deleteEdge = useProjectStore((s) => s.deleteEdge);
  const setEdgeOffset = useProjectStore((s) => s.setEdgeOffset);
  const highlighted = useProjectStore((s) => s.highlightedEdges.has(id));
  const edges = useProjectStore((s) => s.edges);
  const edgeOffset = useProjectStore((s) => s.edgeOffsets[id] || 0);
  const currentStage = useProjectStore((s) => s.currentStage);
  const nodes = useProjectStore((s) => s.nodes);

  // Stage focus
  const sourceNode = useMemo(() => nodes.find((n) => n.id === source), [nodes, source]);
  const targetNode = useMemo(() => nodes.find((n) => n.id === target), [nodes, target]);
  const srcInStage = sourceNode?.data?.stage === currentStage;
  const tgtInStage = targetNode?.data?.stage === currentStage;
  const neitherInStage = !srcInStage && !tgtInStage;
  const isCrossStage = (srcInStage && !tgtInStage) || (!srcInStage && tgtInStage);

  // Pin fan offset for shared handles
  const { srcOffset, tgtOffset } = useMemo(() => {
    const srcSiblings = edges.filter(
      (e) => e.source === source && e.sourceHandle === sourceHandleId
    );
    const srcIdx = srcSiblings.findIndex((e) => e.id === id);
    const srcCount = srcSiblings.length;
    const srcOff = srcCount > 1 ? (srcIdx - (srcCount - 1) / 2) * FAN_SPREAD : 0;

    const tgtSiblings = edges.filter(
      (e) => e.target === target && e.targetHandle === targetHandleId
    );
    const tgtIdx = tgtSiblings.findIndex((e) => e.id === id);
    const tgtCount = tgtSiblings.length;
    const tgtOff = tgtCount > 1 ? (tgtIdx - (tgtCount - 1) / 2) * FAN_SPREAD : 0;

    return { srcOffset: srcOff, tgtOffset: tgtOff };
  }, [edges, id, source, sourceHandleId, target, targetHandleId]);

  const adjustedSourceY = sourceY + srcOffset;
  const adjustedTargetY = targetY + tgtOffset;

  let edgePath, labelX, labelY;

  if (isLoop) {
    // Loop edges: curved arc that sweeps below/above to visually indicate a back-edge
    const sx = sourceX;
    const sy = adjustedSourceY;
    const tx = targetX;
    const ty = adjustedTargetY;
    // Arc sweeps below both endpoints
    const dropY = Math.max(sy, ty) + 80 + Math.abs(sx - tx) * 0.15;
    const cpX1 = sx + 40;
    const cpX2 = tx - 40;
    edgePath = `M ${sx} ${sy} C ${cpX1} ${dropY}, ${cpX2} ${dropY}, ${tx} ${ty}`;
    labelX = (sx + tx) / 2;
    labelY = dropY - 20;
  } else {
    // Standard stepped path with controllable vertical segment
    const midX = (sourceX + targetX) / 2 + edgeOffset;
    const clampedMidX = Math.max(sourceX + 4, Math.min(targetX - 4, midX));

    const sy = adjustedSourceY;
    const ty = adjustedTargetY;
    const sx = sourceX;
    const tx = targetX;
    const mx = clampedMidX;

    // Node bounding boxes for collision detection
    const NODE_W = 180;
    const NODE_H_APPROX = 80;
    const MARGIN = 12;
    const tgtPos = targetNode?.position;
    const srcPos = sourceNode?.position;

    // Check if the vertical segment at mx would pass through the target node
    const wouldHitTarget = tgtPos && (
      mx > tgtPos.x - MARGIN && mx < tgtPos.x + NODE_W + MARGIN &&
      ((sy < tgtPos.y && ty > tgtPos.y) || (sy > tgtPos.y + NODE_H_APPROX && ty < tgtPos.y + NODE_H_APPROX) ||
       (Math.abs(sy - ty) > 2 && ty >= tgtPos.y && ty <= tgtPos.y + NODE_H_APPROX))
    );

    // Check if the vertical segment would pass through the source node
    const wouldHitSource = srcPos && (
      mx > srcPos.x - MARGIN && mx < srcPos.x + NODE_W + MARGIN &&
      ((ty < srcPos.y && sy > srcPos.y) || (ty > srcPos.y + NODE_H_APPROX && sy < srcPos.y + NODE_H_APPROX))
    );

    if (Math.abs(sy - ty) < 1) {
      edgePath = `M ${sx} ${sy} L ${tx} ${ty}`;
      labelX = (sx + tx) / 2;
      labelY = sy;
    } else if (wouldHitTarget || wouldHitSource) {
      // Route around the blocking node
      const blockPos = wouldHitTarget ? tgtPos : srcPos;
      const blockW = NODE_W;
      const blockH = NODE_H_APPROX;
      const r = 6;

      // Decide whether to go above or below the blocking node
      const goAbove = sy < blockPos.y + blockH / 2;
      const bypassY = goAbove
        ? blockPos.y - MARGIN
        : blockPos.y + blockH + MARGIN;

      // Route: source → horizontal to just before block → vertical to bypass Y →
      // horizontal past block → vertical to target Y → horizontal to target
      const preX = blockPos.x - MARGIN;
      const postX = blockPos.x + blockW + MARGIN;

      // Use the side closest to target for the approach
      const approachFromLeft = tx > blockPos.x + blockW / 2;
      const edgeX = approachFromLeft ? preX : postX;

      edgePath = [
        `M ${sx} ${sy}`,
        `L ${edgeX - r} ${sy}`,
        `Q ${edgeX} ${sy} ${edgeX} ${sy + (bypassY > sy ? r : -r)}`,
        `L ${edgeX} ${bypassY - (bypassY > sy ? r : -r)}`,
        `Q ${edgeX} ${bypassY} ${edgeX + r} ${bypassY}`,
        `L ${(approachFromLeft ? postX : preX) - r} ${bypassY}`,
        `Q ${approachFromLeft ? postX : preX} ${bypassY} ${approachFromLeft ? postX : preX} ${bypassY + (ty > bypassY ? r : -r)}`,
        `L ${approachFromLeft ? postX : preX} ${ty - (ty > bypassY ? r : -r)}`,
        `Q ${approachFromLeft ? postX : preX} ${ty} ${(approachFromLeft ? postX : preX) + (tx > (approachFromLeft ? postX : preX) ? r : -r)} ${ty}`,
        `L ${tx} ${ty}`,
      ].join(' ');

      labelX = (edgeX + (approachFromLeft ? postX : preX)) / 2;
      labelY = bypassY;
    } else {
      const halfHoriz1 = Math.abs(mx - sx) / 2;
      const halfHoriz2 = Math.abs(tx - mx) / 2;
      const halfVert = Math.abs(ty - sy) / 2;
      const r = Math.min(8, halfHoriz1, halfHoriz2, halfVert);

      if (r < 1) {
        edgePath = `M ${sx} ${sy} L ${mx} ${sy} L ${mx} ${ty} L ${tx} ${ty}`;
      } else {
        const goingDown = ty > sy;
        const ry = goingDown ? r : -r;
        edgePath = [
          `M ${sx} ${sy}`,
          `L ${mx - r} ${sy}`,
          `Q ${mx} ${sy} ${mx} ${sy + ry}`,
          `L ${mx} ${ty - ry}`,
          `Q ${mx} ${ty} ${mx + r} ${ty}`,
          `L ${tx} ${ty}`,
        ].join(' ');
      }

      labelX = mx;
      labelY = (sy + ty) / 2;
    }
  }

  // Drag the midpoint handle to adjust offset
  const onHandleMouseDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startOffset = useProjectStore.getState().edgeOffsets[id] || 0;

    const onMouseMove = (me) => {
      const dx = me.clientX - startX;
      const zoom = useProjectStore.getState().canvasZoom || 1;
      useProjectStore.getState().setEdgeOffset(id, startOffset + dx / zoom);
    };

    const onMouseUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [id, edgeOffset, setEdgeOffset]);

  const isGlowing = highlighted && !hovered;
  let baseStroke = isLoop ? '#a78bfa' : (style.stroke || '#38bdf8'); // purple for loops
  let edgeOpacity = 1;

  if (neitherInStage) {
    edgeOpacity = 0.08;
  } else if (isCrossStage) {
    edgeOpacity = 0.35;
  }

  const strokeColor = hovered ? '#f87171' : isGlowing ? '#60a5fa' : baseStroke;
  const strokeW = hovered ? 3 : isGlowing ? 3 : (style.strokeWidth || 2);

  const gradientId = `edge-grad-${id}`;
  const needsGradient = isCrossStage && !hovered && !isGlowing;
  const isInFocus = !neitherInStage;
  const showControls = (hovered || handleHovered || dragging) && !readOnly && isInFocus;

  return (
    <>
      {isGlowing && (
        <defs>
          <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      {needsGradient && (
        <defs>
          <linearGradient id={gradientId}
            x1={srcInStage ? '0%' : '100%'} y1="0%"
            x2={srcInStage ? '100%' : '0%'} y2="0%"
          >
            <stop offset="0%" stopColor={baseStroke} stopOpacity="1" />
            <stop offset="65%" stopColor={baseStroke} stopOpacity="0.9" />
            <stop offset="80%" stopColor={baseStroke} stopOpacity="0.3" />
            <stop offset="92%" stopColor={baseStroke} stopOpacity="0.08" />
            <stop offset="100%" stopColor={baseStroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>
      )}
      {/* Invisible wider path for hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { if (!dragging) setHovered(false); }}
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: needsGradient ? `url(#${gradientId})` : strokeColor,
          strokeWidth: strokeW,
          strokeDasharray: isLoop ? '6 4' : 'none',
          opacity: needsGradient ? 1 : edgeOpacity,
          filter: isGlowing ? `url(#glow-${id})` : 'none',
          transition: 'opacity 500ms ease, stroke 0.15s, stroke-width 0.15s',
        }}
      />
      {/* Midpoint controls — wrapped in a tall invisible hit area */}
      {isInFocus && !readOnly && (
        <EdgeLabelRenderer>
          {/* Large invisible hover zone centered on midpoint */}
          <div
            onMouseEnter={() => { setHandleHovered(true); setHovered(true); }}
            onMouseLeave={() => { if (!dragging) { setHandleHovered(false); setHovered(false); } }}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
              width: 40,
              height: 80,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              cursor: 'default',
            }}
          >
            {/* Delete button — above the handle */}
            {showControls && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteEdge(id);
                }}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#ef4444',
                  color: '#fff',
                  border: '2px solid #23272f',
                  fontSize: 10,
                  lineHeight: '10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                  flexShrink: 0,
                }}
                title="Remove connection"
              >
                ×
              </button>
            )}
            {/* Drag handle */}
            <div
              onMouseDown={onHandleMouseDown}
              style={{
                width: showControls ? 16 : 8,
                height: showControls ? 16 : 8,
                borderRadius: '50%',
                background: dragging ? '#60a5fa' : showControls ? '#2a2a3e' : '#3a3a4e',
                border: showControls ? '2px solid #60a5fa' : '1px solid #4a4a5e',
                cursor: 'ew-resize',
                transition: 'width 0.15s, height 0.15s, background 0.15s, border 0.15s',
                opacity: showControls ? 1 : 0.6,
                flexShrink: 0,
              }}
              title="Drag to offset edge route"
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
