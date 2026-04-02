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

  // Pin fan offset — sorted by source/target Y position
  const { srcOffset, tgtOffset, verticalSpread } = useMemo(() => {
    // Source fan: sorted by target Y
    const srcSiblings = edges
      .filter((e) => e.source === source && e.sourceHandle === sourceHandleId)
      .sort((a, b) => {
        const aNode = nodes.find((n) => n.id === a.target);
        const bNode = nodes.find((n) => n.id === b.target);
        return (aNode?.position?.y || 0) - (bNode?.position?.y || 0);
      });
    const srcIdx = srcSiblings.findIndex((e) => e.id === id);
    const srcCount = srcSiblings.length;
    const srcOff = srcCount > 1 ? (srcIdx - (srcCount - 1) / 2) * FAN_SPREAD : 0;

    // Target fan: sorted by source Y — ONLY by source node position
    const tgtSiblings = edges
      .filter((e) => e.target === target && e.targetHandle === targetHandleId)
      .sort((a, b) => {
        const aNode = nodes.find((n) => n.id === a.source);
        const bNode = nodes.find((n) => n.id === b.source);
        return (aNode?.position?.y || 0) - (bNode?.position?.y || 0);
      });
    const tgtIdx = tgtSiblings.findIndex((e) => e.id === id);
    const tgtCount = tgtSiblings.length;
    const tgtOff = tgtCount > 1 ? (tgtIdx - (tgtCount - 1) / 2) * FAN_SPREAD : 0;

    // Vertical segment spread: sort by target Y across ALL edges from same source NODE
    // This prevents edges from different pins on the same source from crossing mid-path
    const allFromSrc = edges
      .filter((e) => e.source === source)
      .sort((a, b) => {
        const aNode = nodes.find((n) => n.id === a.target);
        const bNode = nodes.find((n) => n.id === b.target);
        return (aNode?.position?.y || 0) - (bNode?.position?.y || 0);
      });
    const srcNodeIdx = allFromSrc.findIndex((e) => e.id === id);
    const srcNodeCount = allFromSrc.length;
    const nodeSpread = srcNodeCount > 1 ? (srcNodeIdx - (srcNodeCount - 1) / 2) * 15 : 0;

    // Target-pin spread (edges to same pin) + source-node spread (edges from same node)
    const tgtPinSpread = tgtCount > 1 ? (tgtIdx - (tgtCount - 1) / 2) * 20 : 0;

    return { srcOffset: srcOff, tgtOffset: tgtOff, verticalSpread: tgtPinSpread + nodeSpread };
  }, [edges, id, source, sourceHandleId, target, targetHandleId, nodes]);

  const adjustedSourceY = sourceY + srcOffset;
  const adjustedTargetY = targetY + tgtOffset;

  let edgePath, labelX, labelY;
  let handleXPos = null; // control point handle

  const sx = sourceX;
  const sy = adjustedSourceY;
  const tx = targetX;
  const ty = adjustedTargetY;

  if (isLoop) {
    // Loop edges: orthogonal path that routes below/around the nodes
    // Exit source rightward, go down below both nodes, go left, enter target from left
    const srcPos = sourceNode?.position;
    const tgtPos = targetNode?.position;
    const srcH = sourceNode?.measured?.height || 80;
    const tgtH = targetNode?.measured?.height || 80;
    const M = 25;
    const R = 8;

    // Go below both nodes
    const belowY = Math.max(
      srcPos ? srcPos.y + srcH : sy,
      tgtPos ? tgtPos.y + tgtH : ty,
    ) + M + offY;

    // Right stub from source, then down, then left to target, then up into target
    const rightX = sx + M + offX;
    const leftX = tx - M;

    // Use buildPath if available, otherwise manual
    const points = [
      { x: sx, y: sy },
      { x: rightX, y: sy },
      { x: rightX, y: belowY },
      { x: leftX, y: belowY },
      { x: leftX, y: ty },
      { x: tx, y: ty },
    ];

    // Build rounded path
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1], curr = points[i], next = points[i + 1];
      const lenIn = Math.max(Math.abs(curr.x - prev.x), Math.abs(curr.y - prev.y));
      const lenOut = Math.max(Math.abs(next.x - curr.x), Math.abs(next.y - curr.y));
      const r = Math.min(R, lenIn / 2, lenOut / 2);
      if (r < 1) { d += ` L ${curr.x} ${curr.y}`; continue; }
      const dxIn = Math.sign(curr.x - prev.x), dyIn = Math.sign(curr.y - prev.y);
      const dxOut = Math.sign(next.x - curr.x), dyOut = Math.sign(next.y - curr.y);
      d += ` L ${curr.x - dxIn * r} ${curr.y - dyIn * r}`;
      d += ` Q ${curr.x} ${curr.y} ${curr.x + dxOut * r} ${curr.y + dyOut * r}`;
    }
    d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
    edgePath = d;

    labelX = (rightX + leftX) / 2;
    labelY = belowY;
    handleXPos = { x: labelX, y: belowY };
  } else {
    // Orthogonal stepped path with rounded corners — like plumbing pipes
    // Use actual measured widths when available
    const srcW = sourceNode?.measured?.width || sourceNode?.width || 180;
    const tgtW = targetNode?.measured?.width || targetNode?.width || 180;
    const NODE_H = 100;
    const MARGIN = 20;
    const R = 8; // corner radius
    const srcPos = sourceNode?.position;
    const tgtPos = targetNode?.position;

    const dx = tx - sx;

    // Helper: build a rounded-corner stepped path from a list of waypoints
    const buildPath = (points) => {
      if (points.length < 2) return `M ${points[0].x} ${points[0].y}`;
      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];
        // Clamp radius to half the shortest adjacent segment
        const lenIn = Math.max(Math.abs(curr.x - prev.x), Math.abs(curr.y - prev.y));
        const lenOut = Math.max(Math.abs(next.x - curr.x), Math.abs(next.y - curr.y));
        const r = Math.min(R, lenIn / 2, lenOut / 2);
        if (r < 1) {
          d += ` L ${curr.x} ${curr.y}`;
          continue;
        }
        // Direction vectors
        const dxIn = Math.sign(curr.x - prev.x);
        const dyIn = Math.sign(curr.y - prev.y);
        const dxOut = Math.sign(next.x - curr.x);
        const dyOut = Math.sign(next.y - curr.y);
        // Line to just before the corner
        d += ` L ${curr.x - dxIn * r} ${curr.y - dyIn * r}`;
        // Quadratic curve around the corner
        d += ` Q ${curr.x} ${curr.y} ${curr.x + dxOut * r} ${curr.y + dyOut * r}`;
      }
      d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
      return d;
    };

    // Use pin positions directly — is there horizontal space for a Z-path?
    const srcRight = srcPos ? srcPos.x + srcW : sx;
    const tgtLeft = tgtPos ? tgtPos.x : tx;

    // Check if Z-path is viable: need a clear gap between node edges
    const GAP = 20;
    const gapStart = srcRight + GAP;
    const gapEnd = tgtLeft - GAP;
    // Z-path only if there's a real gap AND midX would stay between the pins
    const canZPath = dx > 0 && gapEnd > gapStart && gapStart < tx && gapEnd > sx;

    if (canZPath) {
      // Z-PATH: horizontal → vertical → horizontal
      const gapCenter = (gapStart + gapEnd) / 2;
      const midX = Math.max(gapStart, Math.min(gapEnd, gapCenter + offX + verticalSpread));

      const points = [
        { x: sx, y: sy },
        { x: midX, y: sy },
        { x: midX, y: ty },
        { x: tx, y: ty },
      ];
      edgePath = buildPath(points);
      labelX = midX;
      labelY = (sy + ty) / 2;
      handleXPos = { x: midX, y: (sy + ty) / 2 };
    } else {
      // STACKED/BEHIND: target is below/above or overlapping
      // Route LEFT of both nodes, through the gap between them

      // Vertical segment X: left of the TARGET node (where the edge arrives)
      // This minimizes winding distance — the edge goes to where it needs to be
      const tgtLeftEdge = tgtPos ? tgtPos.x : tx;
      const vertX = tgtLeftEdge - MARGIN + offX;

      // Horizontal channel Y: midpoint of the GAP between node edges
      // Use actual measured node heights when available
      const srcH = sourceNode?.measured?.height || sourceNode?.height || NODE_H;
      const tgtH = targetNode?.measured?.height || targetNode?.height || NODE_H;
      const srcNodeBot = srcPos ? srcPos.y + srcH : sy + 20;
      const srcNodeTop = srcPos ? srcPos.y : sy - 20;
      const tgtNodeBot = tgtPos ? tgtPos.y + tgtH : ty + 20;
      const tgtNodeTop = tgtPos ? tgtPos.y : ty - 20;

      let midY;
      if (sy < ty) {
        // Source above target — gap is between source bottom edge and target top edge
        const gapTop = srcNodeBot;
        const gapBot = tgtNodeTop;
        midY = (gapTop + gapBot) / 2 + offY;
      } else {
        // Source below target — gap is between target bottom edge and source top edge
        const gapTop = tgtNodeBot;
        const gapBot = srcNodeTop;
        midY = (gapTop + gapBot) / 2 + offY;
      }

      // Exit stub: must clear the source node's right edge
      const srcRightEdge = srcPos ? srcPos.x + srcW + MARGIN : sx + MARGIN;
      const stubX = Math.max(sx + MARGIN, srcRightEdge);

      const points = [
        { x: sx, y: sy },
        { x: stubX, y: sy },      // short stub RIGHT from output pin
        { x: stubX, y: midY },    // vertical to the channel
        { x: vertX, y: midY },    // horizontal left past both nodes
        { x: vertX, y: ty },      // vertical to target pin height
        { x: tx, y: ty },         // into the target pin
      ];
      edgePath = buildPath(points);
      labelX = vertX;
      labelY = midY;
      handleXPos = { x: (vertX + stubX) / 2, y: midY };
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
  let baseStroke = style.stroke || '#38bdf8'; // same colour for all edges
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
          strokeDasharray: '8 4',
          animation: 'dash-flow 0.6s linear infinite',
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
