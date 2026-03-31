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
  let handleXPos = null; // control point handle

  const sx = sourceX;
  const sy = adjustedSourceY;
  const tx = targetX;
  const ty = adjustedTargetY;

  if (isLoop) {
    // Loop edges: curved arc sweeping below
    const dropY = Math.max(sy, ty) + 80 + Math.abs(sx - tx) * 0.15;
    edgePath = `M ${sx} ${sy} C ${sx + 40} ${dropY}, ${tx - 40} ${dropY}, ${tx} ${ty}`;
    labelX = (sx + tx) / 2;
    labelY = dropY - 20;
  } else {
    // Edge routing with adaptive complexity
    const NODE_W = 180;
    const NODE_H = 100;
    const CLEAR = 25;
    const srcPos = sourceNode?.position;
    const tgtPos = targetNode?.position;

    const dx = tx - sx;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(ty - sy);

    // Do the source and target nodes overlap horizontally enough that
    // a simple Bezier would cut through a node body?
    // Only trigger when nodes are truly stacked — X overlap is significant
    const nodesOverlapVertically = srcPos && tgtPos && (
      srcPos.y < tgtPos.y + NODE_H + CLEAR &&
      srcPos.y + NODE_H + CLEAR > tgtPos.y &&
      absDx < NODE_W * 0.8  // tighter threshold — only when really overlapping
    );

    if (nodesOverlapVertically) {
      // --- MULTI-SEGMENT: route with a waypoint to go around both nodes ---
      // Path: source → right → above/below both → left → into target
      // Uses two chained cubic beziers with a waypoint between them

      // Find the right edge — clear of both nodes
      const rightX = Math.max(
        srcPos.x + NODE_W,
        tgtPos.x + NODE_W,
      ) + CLEAR + 40 + offX;

      // Waypoint Y — above or below both nodes
      const topOfBoth = Math.min(srcPos.y, tgtPos.y) - CLEAR - 20;
      const botOfBoth = Math.max(srcPos.y + NODE_H, tgtPos.y + NODE_H) + CLEAR + 20;
      // Route the waypoint to the OPPOSITE side — if source is above target,
      // waypoint goes BELOW both (curve drops down and comes back up).
      // If source is below, waypoint goes ABOVE.
      const goAbove = sy > ty;
      const waypointY = (goAbove ? topOfBoth : botOfBoth) + offY;

      // Waypoint X — to the right, past both nodes
      const waypointX = rightX;

      // Two cubic segments chained at the waypoint
      // Segment 1: source pin → waypoint
      //   Exits right from source, curves up/down to the waypoint
      const t1 = Math.max(40, absDx * 0.3);
      const cp1x = sx + t1;       // exit rightward from source
      const cp1y = sy;            // horizontal exit
      const cp2x = waypointX;     // arrive at waypoint from the left
      const cp2y = waypointY;     // arrive horizontally at waypoint Y

      // Segment 2: waypoint → target pin
      //   Leaves waypoint heading left, curves down/up into target
      const cp3x = waypointX - t1; // leave waypoint heading LEFT
      const cp3y = waypointY;      // horizontal departure from waypoint
      const cp4x = tx - t1;        // approach target from the left
      edgePath = [
        `M ${sx} ${sy}`,
        `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${waypointX} ${waypointY}`,
        `C ${cp3x} ${cp3y}, ${cp4x} ${ty}, ${tx} ${ty}`,
      ].join(' ');

      labelX = waypointX;
      labelY = waypointY;
      handleXPos = { x: (sx + tx) / 2, y: waypointY };
    } else {
      // --- SIMPLE: standard 2-control-point Bezier ---
      const baseTangent = Math.max(40, absDx * 0.35, absDy * 0.2) + offX;

      let cp1x, cp2x;
      if (dx > 80) {
        cp1x = sx + baseTangent;
        cp2x = tx - baseTangent;
      } else {
        const pushRight = Math.max(baseTangent, 80 - dx);
        cp1x = sx + pushRight;
        cp2x = tx + pushRight;
      }

      let cp1y = sy + offY;
      let cp2y = ty + offY;

      edgePath = `M ${sx} ${sy} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${tx} ${ty}`;

      labelX = (sx + tx) / 2;
      labelY = (sy + ty) / 2 + offY * 0.5;
      handleXPos = { x: labelX, y: labelY };
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
      {/* Curve handle + delete button */}
      {isInFocus && !readOnly && (
        <EdgeLabelRenderer>
          {handleXPos && (
            <div
              onMouseEnter={() => { setHandleHovered(true); setHovered(true); }}
              onMouseLeave={() => { if (!dragging) { setHandleHovered(false); setHovered(false); } }}
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${handleXPos.x}px, ${handleXPos.y}px)`,
                pointerEvents: 'all',
                width: 40, height: 40,
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
              {/* Drag handle — X for tangent, Y for curve bias */}
              <div
                onMouseDown={(e) => {
                  e.stopPropagation(); e.preventDefault();
                  setDragging(true);
                  const startMX = e.clientX;
                  const startMY = e.clientY;
                  const raw = useProjectStore.getState().edgeOffsets[id];
                  const startOX = (typeof raw === 'object' ? raw?.x : (raw || 0)) || 0;
                  const startOY = (typeof raw === 'object' ? raw?.y : 0) || 0;

                  const onMouseMove = (me) => {
                    const zoom = useProjectStore.getState().canvasZoom || 1;
                    const dx = (me.clientX - startMX) / zoom;
                    const dy = (me.clientY - startMY) / zoom;
                    useProjectStore.getState().setEdgeOffset(id, { x: startOX + dx, y: startOY + dy });
                  };
                  const onMouseUp = () => {
                    setDragging(false);
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                  };
                  window.addEventListener('mousemove', onMouseMove);
                  window.addEventListener('mouseup', onMouseUp);
                }}
                style={{
                  width: showControls ? 14 : 6, height: showControls ? 14 : 6,
                  borderRadius: '50%',
                  background: dragging ? '#60a5fa' : showControls ? '#2a2a3e' : '#3a3a4e',
                  border: showControls ? '2px solid #60a5fa' : '1px solid #4a4a5e',
                  cursor: 'move', transition: 'all 0.15s',
                  opacity: showControls ? 1 : 0.5, flexShrink: 0,
                }} title="Drag to shape curve"
              />
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}
