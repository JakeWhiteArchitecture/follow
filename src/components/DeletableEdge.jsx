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
  const edgeOffsetRaw = useProjectStore((s) => s.edgeOffsets[id]);
  const offX = (typeof edgeOffsetRaw === 'number' ? edgeOffsetRaw : edgeOffsetRaw?.x) || 0;
  const offY = (typeof edgeOffsetRaw === 'object' ? edgeOffsetRaw?.y : 0) || 0;
  const currentStage = useProjectStore((s) => s.currentStage);
  const isViewAll = useProjectStore((s) => s.viewAll);
  const nodes = useProjectStore((s) => s.nodes);

  // Stage focus
  const sourceNode = useMemo(() => nodes.find((n) => n.id === source), [nodes, source]);
  const targetNode = useMemo(() => nodes.find((n) => n.id === target), [nodes, target]);
  const srcInStage = isViewAll || sourceNode?.data?.stage === currentStage;
  const tgtInStage = isViewAll || targetNode?.data?.stage === currentStage;
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
  let isBypassPath = false;
  let handleXPos = null; // { x, y } for vertical segment handle (drag left/right)
  let handleYPos = null; // { x, y } for horizontal segment handle (drag up/down)

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
    const midX = (sourceX + targetX) / 2 + offX;
    const clampedMidX = Math.max(sourceX + 4, Math.min(targetX - 4, midX));

    const sy = adjustedSourceY;
    const ty = adjustedTargetY;
    const sx = sourceX;
    const tx = targetX;
    const mx = clampedMidX;

    // Node bounding boxes for collision avoidance
    const NODE_W = 180;
    const NODE_H = 80;
    const M = 14; // clearance margin
    const tgtPos = targetNode?.position;
    const srcPos = sourceNode?.position;

    // Collision: only trigger bypass when nodes overlap horizontally
    // (their X ranges intersect) AND the edge path would cross through

    // Check if the horizontal run at ty would cross through the source node body
    // Requires: target input X is within the source node's X range
    const srcOverlapsTargetY = srcPos && (
      ty > srcPos.y - M && ty < srcPos.y + NODE_H + M &&
      tx > srcPos.x - M && tx < srcPos.x + NODE_W + M
    );
    // Check if the horizontal run at sy would cross through the target node body
    const tgtOverlapSourceY = tgtPos && (
      sy > tgtPos.y - M && sy < tgtPos.y + NODE_H + M &&
      sx > tgtPos.x - M && sx < tgtPos.x + NODE_W + M
    );
    // Check if the vertical segment at mx crosses through either node body
    const vertHitsTarget = tgtPos && (
      mx > tgtPos.x - M && mx < tgtPos.x + NODE_W + M &&
      Math.min(sy, ty) < tgtPos.y + NODE_H && Math.max(sy, ty) > tgtPos.y
    );
    const vertHitsSource = srcPos && (
      mx > srcPos.x - M && mx < srcPos.x + NODE_W + M &&
      Math.min(sy, ty) < srcPos.y + NODE_H && Math.max(sy, ty) > srcPos.y
    );

    const needsBypass = srcOverlapsTargetY || tgtOverlapSourceY || vertHitsTarget || vertHitsSource;

    if (Math.abs(sy - ty) < 1) {
      edgePath = `M ${sx} ${sy} L ${tx} ${ty}`;
      labelX = (sx + tx) / 2;
      labelY = sy;
    } else if (needsBypass) {
      const r = 6;

      // offX controls the right-side vertical run X position
      // offY controls the horizontal bypass run Y position
      const rightEdge = Math.max(
        srcPos ? srcPos.x + NODE_W : sx,
        tgtPos ? tgtPos.x + NODE_W : tx,
      ) + M + offX;

      const goAbove = sy < ty;
      const baseBypassY = goAbove
        ? Math.min(srcPos ? srcPos.y : sy, tgtPos ? tgtPos.y : ty) - M
        : Math.max(srcPos ? srcPos.y + NODE_H : sy, tgtPos ? tgtPos.y + NODE_H : ty) + M;
      const bypassY = baseBypassY + offY;

      const leftOfTarget = (tgtPos ? tgtPos.x : tx) - M;

      edgePath = [
        `M ${sx} ${sy}`,
        `L ${rightEdge - r} ${sy}`,
        `Q ${rightEdge} ${sy} ${rightEdge} ${sy + (bypassY > sy ? r : -r)}`,
        `L ${rightEdge} ${bypassY - (bypassY > sy ? r : -r)}`,
        `Q ${rightEdge} ${bypassY} ${rightEdge - r} ${bypassY}`,
        `L ${leftOfTarget + r} ${bypassY}`,
        `Q ${leftOfTarget} ${bypassY} ${leftOfTarget} ${bypassY + (ty > bypassY ? r : -r)}`,
        `L ${leftOfTarget} ${ty - (ty > bypassY ? r : -r)}`,
        `Q ${leftOfTarget} ${ty} ${leftOfTarget + r} ${ty}`,
        `L ${tx} ${ty}`,
      ].join(' ');

      // Store handle positions for rendering
      isBypassPath = true;
      handleXPos = { x: rightEdge, y: (sy + bypassY) / 2 }; // vertical run — drag left/right
      handleYPos = { x: (rightEdge + leftOfTarget) / 2, y: bypassY }; // horizontal run — drag up/down
      labelX = (rightEdge + leftOfTarget) / 2;
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

      handleXPos = { x: mx, y: (sy + ty) / 2 }; // vertical segment — drag left/right
      labelX = mx;
      labelY = (sy + ty) / 2;
    }
  }

  // Generic drag handler for any axis
  const makeHandleDrag = useCallback((axis) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
    const startPos = axis === 'x' ? e.clientX : e.clientY;
    const raw = useProjectStore.getState().edgeOffsets[id];
    const startVal = (typeof raw === 'object' ? raw?.[axis] : (axis === 'x' ? (raw || 0) : 0)) || 0;

    const onMouseMove = (me) => {
      const delta = (axis === 'x' ? me.clientX : me.clientY) - startPos;
      const zoom = useProjectStore.getState().canvasZoom || 1;
      useProjectStore.getState().setEdgeOffset(id, axis, startVal + delta / zoom);
    };

    const onMouseUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [id]);

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
      {/* Segment drag handles + delete button */}
      {isInFocus && !readOnly && (
        <EdgeLabelRenderer>
          {/* X-axis handle (vertical segment — drag left/right) */}
          {handleXPos && (
            <div
              onMouseEnter={() => { setHandleHovered(true); setHovered(true); }}
              onMouseLeave={() => { if (!dragging) { setHandleHovered(false); setHovered(false); } }}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${handleXPos.x}px, ${handleXPos.y}px)`,
                pointerEvents: 'all',
                width: 30, height: 50,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 3,
              }}
            >
              {showControls && (
                <button onClick={(e) => { e.stopPropagation(); deleteEdge(id); }}
                  style={{
                    width: 14, height: 14, borderRadius: '50%', background: '#ef4444',
                    color: '#fff', border: '2px solid #23272f', fontSize: 9, lineHeight: '9px',
                    cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 700, boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                    flexShrink: 0,
                  }} title="Remove connection">×</button>
              )}
              <div onMouseDown={makeHandleDrag('x')}
                style={{
                  width: showControls ? 14 : 6, height: showControls ? 14 : 6,
                  borderRadius: '50%',
                  background: dragging ? '#60a5fa' : showControls ? '#2a2a3e' : '#3a3a4e',
                  border: showControls ? '2px solid #60a5fa' : '1px solid #4a4a5e',
                  cursor: 'ew-resize', transition: 'all 0.15s',
                  opacity: showControls ? 1 : 0.5, flexShrink: 0,
                }} title="Drag left/right" />
            </div>
          )}
          {/* Y-axis handle (horizontal segment — drag up/down) — only on bypass paths */}
          {handleYPos && (
            <div
              onMouseEnter={() => { setHandleHovered(true); setHovered(true); }}
              onMouseLeave={() => { if (!dragging) { setHandleHovered(false); setHovered(false); } }}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${handleYPos.x}px, ${handleYPos.y}px)`,
                pointerEvents: 'all',
                width: 50, height: 30,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div onMouseDown={makeHandleDrag('y')}
                style={{
                  width: showControls ? 14 : 6, height: showControls ? 14 : 6,
                  borderRadius: '50%',
                  background: dragging ? '#10b981' : showControls ? '#2a2a3e' : '#3a3a4e',
                  border: showControls ? '2px solid #10b981' : '1px solid #4a4a5e',
                  cursor: 'ns-resize', transition: 'all 0.15s',
                  opacity: showControls ? 1 : 0.5,
                }} title="Drag up/down" />
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}
