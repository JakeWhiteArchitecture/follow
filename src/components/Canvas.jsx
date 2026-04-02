import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import useProjectStore, { RIBA_STAGES } from '../store/useProjectStore';
import { generateId } from '../utils/id';
import WorkPackageNode from '../nodes/WorkPackageNode';
import DecisionNode from '../nodes/DecisionNode';
import CheckpointNode from '../nodes/CheckpointNode';
import PropertiesPanel, { pendingModuleRef } from './PropertiesPanel';
import DeletableEdge from './DeletableEdge';
import { STAGE_COLORS } from '../utils/colors';

const nodeTypes = {
  workPackage: WorkPackageNode,
  decision: DecisionNode,
  checkpoint: CheckpointNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
};

const defaultEdgeOptions = {
  animated: false,
  style: { stroke: '#38bdf8', strokeWidth: 2 },
  type: 'deletable',
};

// Stage navigation bar with dots
function StageNav({ currentStage, stages, onSelect, viewAll, onToggleViewAll }) {
  const stageKeys = Object.keys(stages).sort((a, b) => parseInt(a) - parseInt(b));
  const stageInfo = RIBA_STAGES.find((s) => s.key === String(currentStage));
  const inAppointment = stages[String(currentStage)]?.in_appointment;
  const colorIdx = parseInt(currentStage);
  const stageColor = STAGE_COLORS[colorIdx] || '#60a5fa';
  const sidebarSide = useProjectStore((s) => s.sidebarSide);
  const isLeft = sidebarSide === 'left';

  return (
    <>
      {/* Dot bar — floating, no background */}
      <div style={{
        position: 'absolute',
        top: 10,
        [isLeft ? 'left' : 'left']: 0,
        [isLeft ? 'right' : 'right']: 0,
        height: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9,
        pointerEvents: 'none',
        gap: 14,
      }}>
        {stageKeys.map((key) => {
          const isActive = key === String(currentStage);
          const isInAppt = stages[key]?.in_appointment;
          const ci = parseInt(key);
          const label = RIBA_STAGES.find((s) => s.key === key)?.label || `Stage ${key}`;
          return (
            <button
              key={key}
              onClick={() => onSelect(parseInt(key))}
              style={{
                width: isActive ? 10 : 6,
                height: isActive ? 10 : 6,
                borderRadius: '50%',
                background: isActive ? (STAGE_COLORS[ci] || '#60a5fa') : isInAppt ? '#4a4a5e' : '#2a2a3e',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                padding: 0,
                pointerEvents: 'auto',
                boxShadow: isActive ? `0 0 8px ${STAGE_COLORS[ci] || '#60a5fa'}60` : 'none',
              }}
              title={label}
            />
          );
        })}
      </div>
      {/* Stage label — floating, no background */}
      <div style={{
        position: 'absolute',
        top: 32,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 8,
        pointerEvents: 'none',
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: viewAll ? '#9ca3af' : inAppointment ? stageColor : '#6b7280',
          opacity: viewAll ? 0.6 : inAppointment ? 0.5 : 0.3,
          transition: 'color 0.3s ease, opacity 0.3s ease',
        }}>
          {viewAll ? 'All Stages' : (stageInfo?.label || `Stage ${currentStage}`)}
          {!viewAll && !inAppointment && ' — outside appointment'}
        </span>
        <button
          onClick={onToggleViewAll}
          style={{
            marginLeft: 8,
            fontSize: 9,
            color: '#6b7280',
            background: 'none',
            border: '1px solid #3a3a4e',
            borderRadius: 3,
            padding: '1px 6px',
            cursor: 'pointer',
            pointerEvents: 'auto',
            transition: 'color 0.2s',
          }}
        >
          {viewAll ? 'Filter by Stage' : 'View All'}
        </button>
      </div>
    </>
  );
}

// Hover chevron on screen edge
function EdgeChevron({ side, visible, onClick, label }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side]: 0,
        width: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: visible ? 'pointer' : 'default',
        zIndex: 8,
        opacity: hovered && visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div style={{
        width: 36,
        height: 100,
        background: 'linear-gradient(' +
          (side === 'left' ? '90deg' : '270deg') +
          ', rgba(59,130,246,0.15), transparent)',
        borderRadius: side === 'left' ? '0 8px 8px 0' : '8px 0 0 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 4,
      }}>
        <span style={{
          fontSize: 24,
          color: '#60a5fa',
          fontWeight: 300,
          lineHeight: 1,
        }}>
          {side === 'left' ? '‹' : '›'}
        </span>
        {label && (
          <span style={{
            fontSize: 8,
            color: '#60a5fa',
            writingMode: 'vertical-lr',
            textOrientation: 'mixed',
            whiteSpace: 'nowrap',
            letterSpacing: 0.5,
          }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// Approximate node dimensions for bounding box calculation
const NODE_DIMS = { workPackage: { w: 180, h: 64 }, decision: { w: 180, h: 64 }, checkpoint: { w: 140, h: 46 } };

function ModuleBackgrounds({ modules, nodes, viewport, onModuleClick, onModuleDragStart }) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edges = useProjectStore((s) => s.edges);
  const edgeOffsets = useProjectStore((s) => s.edgeOffsets);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {modules.map((mod) => {
        const memberNodes = mod.members.map((id) => nodeMap.get(id)).filter(Boolean);
        if (memberNodes.length === 0) return null;

        const memberIds = new Set(mod.members);

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        memberNodes.forEach((n) => {
          const w = n.measured?.width || NODE_DIMS[n.type]?.w || 180;
          const h = n.measured?.height || NODE_DIMS[n.type]?.h || 64;
          minX = Math.min(minX, n.position.x);
          minY = Math.min(minY, n.position.y);
          maxX = Math.max(maxX, n.position.x + w);
          maxY = Math.max(maxY, n.position.y + h);
        });

        // Expand bounding box to include edge geometry
        // Edges between module members may route outside the node bbox
        edges.forEach((e) => {
          if (!memberIds.has(e.source) || !memberIds.has(e.target)) return;
          const srcNode = nodeMap.get(e.source);
          const tgtNode = nodeMap.get(e.target);
          if (!srcNode || !tgtNode) return;

          const srcW = srcNode.measured?.width || 180;
          const srcH = srcNode.measured?.height || 64;
          const tgtH = tgtNode.measured?.height || 64;
          const off = edgeOffsets[e.id];
          const offX = (typeof off === 'object' ? off?.x : (off || 0)) || 0;
          const offY = (typeof off === 'object' ? off?.y : 0) || 0;

          // U-path stub goes right of source
          const stubX = srcNode.position.x + srcW + 20;
          maxX = Math.max(maxX, stubX + offX);

          // U-path midY goes below/above nodes
          const srcBot = srcNode.position.y + srcH;
          const tgtBot = tgtNode.position.y + tgtH;
          maxY = Math.max(maxY, srcBot + 20 + Math.max(0, offY));
          maxY = Math.max(maxY, tgtBot + 20 + Math.max(0, offY));

          // Loop edges go below
          if (e.data?.loop) {
            maxY = Math.max(maxY, Math.max(srcBot, tgtBot) + 50);
          }

          // U-path vertX goes left of target
          const vertX = tgtNode.position.x - 20 + offX;
          minX = Math.min(minX, vertX);
        });

        const pad = mod.padding || 40;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;

        const left = minX * viewport.zoom + viewport.x;
        const top = minY * viewport.zoom + viewport.y;
        const width = (maxX - minX) * viewport.zoom;
        const height = (maxY - minY) * viewport.zoom;

        const borderW = 8;
        const borderColor = mod.stroke || '#c8c4bc';
        const borderDown = (e) => {
          e.stopPropagation();
          onModuleClick(mod);
          onModuleDragStart(e, mod);
        };
        const borderStyle = { position: 'absolute', cursor: 'grab', pointerEvents: 'auto' };

        return (
          <div key={mod.id} style={{
            position: 'absolute',
            left, top, width, height,
            pointerEvents: 'none',
          }}>
            {/* Fill — no pointer events */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: mod.fill || 'rgba(58,107,82,0.04)',
              borderRadius: 6,
              border: `1px solid ${borderColor}40`,
            }} />
            {/* Four clickable border strips */}
            <div onMouseDown={borderDown} style={{ ...borderStyle, top: -borderW/2, left: 0, right: 0, height: borderW }} />
            <div onMouseDown={borderDown} style={{ ...borderStyle, bottom: -borderW/2, left: 0, right: 0, height: borderW }} />
            <div onMouseDown={borderDown} style={{ ...borderStyle, left: -borderW/2, top: 0, bottom: 0, width: borderW }} />
            <div onMouseDown={borderDown} style={{ ...borderStyle, right: -borderW/2, top: 0, bottom: 0, width: borderW }} />
            {/* Label */}
            <span
              onMouseDown={borderDown}
              style={{
              position: 'absolute',
              top: -16,
              left: 4,
              fontSize: Math.max(11, 9 / (viewport.zoom || 1)),
              fontWeight: 600,
              color: borderColor,
              opacity: 0.7,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}>
              {mod.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const megaNumberStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '38vw',
  fontSize: '38vw',
  fontWeight: 900,
  lineHeight: 1,
  textAlign: 'center',
  pointerEvents: 'none',
  userSelect: 'none',
  zIndex: 0,
  transition: 'transform 600ms cubic-bezier(0.4, 0, 0.2, 1), opacity 600ms ease',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  transformStyle: 'preserve-3d',
  backfaceVisibility: 'hidden',
};

// Individual animating number — mounts at startTransform, transitions to endTransform
function AnimatingNumber({ stage, startTransform, startOpacity, endTransform, endOpacity, color }) {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Write the start style directly to avoid React batching
    el.style.transform = startTransform;
    el.style.opacity = String(startOpacity);
    // Force layout
    el.getBoundingClientRect();
    // Now apply end state — CSS transition will animate
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transform = endTransform;
        el.style.opacity = String(endOpacity);
      });
    });
  }, []);

  return (
    <div ref={ref} style={{
      ...megaNumberStyle,
      transform: startTransform,
      opacity: startOpacity,
      color,
    }}>
      {stage}
    </div>
  );
}

function MegaStageNumber({ currentStage, stageKeys }) {
  const prevStageRef = useRef(currentStage);
  const [animKey, setAnimKey] = useState(0);
  const [anim, setAnim] = useState(null); // { prevStage, nextStage, dir }
  const timeoutRef = useRef(null);

  useEffect(() => {
    const prev = prevStageRef.current;
    prevStageRef.current = currentStage;
    if (prev === currentStage) return;

    const prevIdx = stageKeys.indexOf(String(prev));
    const nextIdx = stageKeys.indexOf(String(currentStage));
    const dir = nextIdx > prevIdx ? 'right' : 'left';

    setAnimKey((k) => k + 1);
    setAnim({ prevStage: prev, nextStage: currentStage, dir });

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setAnim(null), 650);
    return () => clearTimeout(timeoutRef.current);
  }, [currentStage, stageKeys]);

  const center = 'translate(-50%, -50%) rotateY(0deg)';

  // Wrap everything in a perspective container
  const perspectiveWrap = (children) => (
    <div style={{
      position: 'absolute',
      inset: 0,
      perspective: '1200px',
      perspectiveOrigin: '50% 50%',
      pointerEvents: 'none',
      zIndex: 0,
    }}>
      {children}
    </div>
  );

  if (anim) {
    const { prevStage, nextStage, dir } = anim;
    // Going right: both numbers move left. Going left: both move right.
    const exitX = dir === 'right' ? '-110%' : '110%';
    const enterX = dir === 'right' ? '110%' : '-110%';
    const exitRotY = dir === 'right' ? '-60deg' : '60deg';
    const enterRotY = dir === 'right' ? '60deg' : '-60deg';
    const prevColor = STAGE_COLORS[parseInt(prevStage)] || '#60a5fa';
    const nextColor = STAGE_COLORS[parseInt(nextStage)] || '#60a5fa';

    return perspectiveWrap(
      <>
        <AnimatingNumber
          key={`out-${animKey}`}
          stage={prevStage}
          startTransform={center}
          startOpacity={0.06}
          endTransform={`translate(-50%, -50%) translateX(${exitX}) rotateY(${exitRotY})`}
          endOpacity={0}
          color={prevColor}
        />
        <AnimatingNumber
          key={`in-${animKey}`}
          stage={nextStage}
          startTransform={`translate(-50%, -50%) translateX(${enterX}) rotateY(${enterRotY})`}
          startOpacity={0}
          endTransform={center}
          endOpacity={0.075}
          color={nextColor}
        />
      </>
    );
  }

  const idleColor = STAGE_COLORS[parseInt(currentStage)] || '#60a5fa';
  return perspectiveWrap(
    <div style={{
      ...megaNumberStyle,
      transform: center,
      color: idleColor,
      opacity: 0.05,
    }}>
      {currentStage}
    </div>
  );
}

function CanvasInner({ currentStage, setCurrentStage, addMode, setAddMode, stages, viewAll }) {
  const { fitView, setViewport: setRFViewport, getViewport } = useReactFlow();
  const nodes = useProjectStore((s) => s.nodes);
  const edges = useProjectStore((s) => s.edges);
  const modules = useProjectStore((s) => s.modules);
  const onNodesChange = useProjectStore((s) => s.onNodesChange);
  const onEdgesChange = useProjectStore((s) => s.onEdgesChange);
  const onConnect = useProjectStore((s) => s.onConnect);
  const addNode = useProjectStore((s) => s.addNode);
  const addNodeAndConnect = useProjectStore((s) => s.addNodeAndConnect);
  const addModule = useProjectStore((s) => s.addModule);
  const importModuleNodes = useProjectStore((s) => s.importModuleNodes);
  const selectNode = useProjectStore((s) => s.selectNode);
  const deselectNode = useProjectStore((s) => s.deselectNode);
  const readOnly = useProjectStore((s) => s.readOnly);

  const [viewport, setViewportLocal] = useState({ x: 0, y: 0, zoom: 1 });
  const handleViewportChange = useCallback((vp) => {
    setViewportLocal(vp);
    useProjectStore.setState({ canvasZoom: vp.zoom });
  }, []);
  const setViewport = handleViewportChange;
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
  const wrapperRef = useRef(null);
  const connectStartRef = useRef(null);
  const stageKeys = Object.keys(stages).sort((a, b) => parseInt(a) - parseInt(b));

  // Check if selected nodes form an existing module
  const selectedArr = [...selectedNodeIds];
  const isModuleSelected = selectedNodeIds.size >= 2 && modules.some((m) =>
    selectedArr.every((nid) => m.members.includes(nid))
  );

  // All nodes visible — current stage full (or all full in viewAll), others ghosted
  const stageNodeIds = new Set(nodes.filter((n) => n.data.stage === currentStage).map((n) => n.id));
  const styledNodes = nodes.map((n) => {
    const inStage = viewAll || stageNodeIds.has(n.id);
    const isMultiSelected = selectedNodeIds.has(n.id);
    return {
      ...n,
      selected: isMultiSelected,
      className: isMultiSelected ? 'tw-selected' : '',
      style: {
        transition: 'opacity 500ms ease, filter 500ms ease',
        ...(inStage ? { opacity: 1, filter: 'none' } : { opacity: 0.15, filter: 'grayscale(0.7)' }),
        ...(isMultiSelected && isModuleSelected
          ? { boxShadow: '0 0 8px rgba(167,139,250,0.3)' }
          : isMultiSelected
          ? { outline: '2px solid #f59e0b', outlineOffset: 2, borderRadius: 4 }
          : {}),
      },
      zIndex: isMultiSelected ? 20 : inStage ? 10 : 0,
    };
  });

  // Smooth pan to the centroid of the current stage's nodes (preserve zoom)
  const isFirstRender = useRef(true);
  const panAnimRef = useRef(null);
  useEffect(() => {
    if (viewAll) return; // no pan in viewAll mode
    if (isFirstRender.current) {
      isFirstRender.current = false;
      const timer = setTimeout(() => {
        const stageNodes = nodes.filter((n) => n.data.stage === currentStage);
        if (stageNodes.length > 0) {
          fitView({ nodes: stageNodes, padding: 0.4, duration: 0 });
        }
      }, 50);
      return () => clearTimeout(timer);
    }

    // Defer pan start so React Flow settles after restyle
    cancelAnimationFrame(panAnimRef.current);
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const stageNodes = nodes.filter((n) => n.data.stage === currentStage);
        if (stageNodes.length === 0) return;

        let cx = 0, cy = 0;
        stageNodes.forEach((n) => { cx += n.position.x; cy += n.position.y; });
        cx /= stageNodes.length;
        cy /= stageNodes.length;

        // Always use the current viewport zoom — never override what the user has set
        const startVp = getViewport();
        const zoom = startVp.zoom;
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const { width } = wrapper.getBoundingClientRect();
        const targetX = width / 2 - cx * zoom;
        const startX = startVp.x;
        const startY = startVp.y;
        const duration = 600;
        const startTime = performance.now();

        const animate = (now) => {
          const elapsed = now - startTime;
          const t = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          const x = startX + (targetX - startX) * ease;
          setRFViewport({ x, y: startY, zoom }, { duration: 0 });
          if (t < 1) panAnimRef.current = requestAnimationFrame(animate);
        };
        panAnimRef.current = requestAnimationFrame(animate);
      });
    });

    return () => { cancelAnimationFrame(rafId); cancelAnimationFrame(panAnimRef.current); };
  }, [currentStage]);

  // Find all modules a node belongs to
  const getModulesForNode = useCallback((nodeId) => {
    return modules.filter((m) => m.members.includes(nodeId));
  }, [modules]);

  // Select all members of a module
  const selectModuleMembers = useCallback((mod) => {
    setSelectedNodeIds(new Set(mod.members));
  }, []);

  // Export selected nodes as a reusable module snippet
  const exportSnippet = useCallback(() => {
    const selectedArr = [...selectedNodeIds];
    const selectedSet = new Set(selectedArr);
    const storeState = useProjectStore.getState();

    // Find the selected nodes
    const selNodes = storeState.nodes.filter((n) => selectedSet.has(n.id));
    if (selNodes.length === 0) return;

    // Calculate origin (top-left of bounding box) for relative positions
    const minX = Math.min(...selNodes.map((n) => n.position.x));
    const minY = Math.min(...selNodes.map((n) => n.position.y));

    // Build snippet nodes with relative positions
    const snippetNodes = selNodes.map((n) => ({
      id: n.id,
      type: n.data.nodeType,
      label: n.data.label,
      role: n.data.role,
      position: { x: n.position.x - minX, y: n.position.y - minY },
      inputs: (n.data.groups || []).map((g) => g.inputLabel),
      outputs: (n.data.groups || []).flatMap((g) => (g.outputs || []).map((o) => o.label)),
      groups: n.data.groups,
    }));

    // Find edges between selected nodes
    const snippetEdges = storeState.edges
      .filter((e) => selectedSet.has(e.source) && selectedSet.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        source_handle: e.sourceHandle,
        target_handle: e.targetHandle,
        ...(e.data?.loop ? { loop: true } : {}),
      }));

    // Include edge offsets for selected edges
    const snippetOffsets = {};
    snippetEdges.forEach((e) => {
      const key = storeState.edges.find(
        (se) => se.source === e.source && se.target === e.target &&
                se.sourceHandle === e.source_handle && se.targetHandle === e.target_handle
      )?.id;
      if (key && storeState.edgeOffsets[key]) {
        snippetOffsets[`${e.source}_${e.target}`] = storeState.edgeOffsets[key];
      }
    });

    const label = prompt('Snippet label:');
    if (!label || !label.trim()) return;

    const snippet = {
      module: {
        label: label.trim(),
        nodes: snippetNodes,
        edges: snippetEdges,
        edgeOffsets: Object.keys(snippetOffsets).length > 0 ? snippetOffsets : undefined,
      },
    };

    // Copy to clipboard and download
    const json = JSON.stringify(snippet, null, 2);
    navigator.clipboard?.writeText(json).catch(() => {});
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${label.trim().replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setSelectedNodeIds(new Set());
  }, [selectedNodeIds]);

  const onNodeClick = useCallback((event, node) => {
    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd+click: select entire module this node belongs to
      const nodeMods = getModulesForNode(node.id);
      if (nodeMods.length > 0) {
        selectModuleMembers(nodeMods[0]);
      } else {
        // Not in a module — just toggle in multi-select
        setSelectedNodeIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) next.delete(node.id);
          else next.add(node.id);
          return next;
        });
      }
    } else if (event.shiftKey) {
      // Shift+click: toggle individual node in multi-select
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
    } else {
      setSelectedNodeIds(new Set());
      selectNode(node.id);
    }
  }, [selectNode, getModulesForNode, selectModuleMembers]);

  const onPaneClick = useCallback((event) => {
    if (addMode && !readOnly) {
      const name = prompt(`Name this ${addMode.replace(/_/g, ' ')}:`);
      if (!name || !name.trim()) { setAddMode(null); return; }
      const bounds = wrapperRef.current.getBoundingClientRect();
      const position = {
        x: (event.clientX - bounds.left - viewport.x) / viewport.zoom,
        y: (event.clientY - bounds.top - viewport.y) / viewport.zoom,
      };
      addNode(addMode, position, currentStage, name.trim());
      setAddMode(null);
    } else {
      deselectNode();
      setSelectedNodeIds(new Set());
    }
  }, [addMode, readOnly, viewport, currentStage, addNode, deselectNode, setAddMode]);

  const onConnectStart = useCallback((_, params) => {
    connectStartRef.current = params;
  }, []);

  const onConnectEnd = useCallback((event) => {
    if (readOnly || !connectStartRef.current) return;
    const startParams = connectStartRef.current;
    connectStartRef.current = null;
    const isPane = event.target.classList?.contains('react-flow__pane');
    if (!isPane) return;
    const name = prompt('Name this work section:');
    if (!name || !name.trim()) return;
    const bounds = wrapperRef.current.getBoundingClientRect();
    const clientX = event.clientX || event.changedTouches?.[0]?.clientX || 0;
    const clientY = event.clientY || event.changedTouches?.[0]?.clientY || 0;
    const position = {
      x: (clientX - bounds.left - viewport.x) / viewport.zoom,
      y: (clientY - bounds.top - viewport.y) / viewport.zoom,
    };
    addNodeAndConnect('work_package', position, currentStage, name.trim(), startParams);
  }, [readOnly, viewport, currentStage, addNodeAndConnect]);

  // Module drop handlers
  const onDragOver = useCallback((e) => {
    if (e.dataTransfer.types.includes('application/follow-module')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onDrop = useCallback((e) => {
    if (!e.dataTransfer.types.includes('application/follow-module')) return;
    e.preventDefault();
    const mod = pendingModuleRef.current;
    if (!mod) return;
    pendingModuleRef.current = null;

    // Resolve stage: use snippet's stage, or current stage, or prompt in viewAll mode
    let dropStage = mod.stage;
    if (dropStage === undefined || dropStage === null) {
      if (viewAll) {
        const input = prompt('Which stage should this module be assigned to? (0-7)');
        if (input === null) return;
        dropStage = parseInt(input) || 0;
      } else {
        dropStage = currentStage;
      }
    }

    const bounds = wrapperRef.current.getBoundingClientRect();
    const dropX = (e.clientX - bounds.left - viewport.x) / viewport.zoom;
    const dropY = (e.clientY - bounds.top - viewport.y) / viewport.zoom;

    // Layout: BFS depth assignment
    const CELL_W = 300, CELL_H = 140;
    const adj = new Map();
    mod.nodes.forEach((n) => adj.set(n.id, []));
    mod.edges.forEach((edge) => {
      if (adj.has(edge.source)) adj.get(edge.source).push(edge.target);
    });

    const depths = new Map();
    const entryId = mod.entry_node || mod.nodes[0]?.id;
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
    const maxD = Math.max(0, ...depths.values());
    mod.nodes.forEach((n) => { if (!depths.has(n.id)) depths.set(n.id, maxD + 1); });

    // Group by depth, assign row
    const columns = {};
    mod.nodes.forEach((n) => {
      const d = depths.get(n.id) || 0;
      if (!columns[d]) columns[d] = [];
      columns[d].push(n);
    });

    const isVert = mod.layout_direction === 'vertical';
    const positions = new Map();
    mod.nodes.forEach((n) => {
      const d = depths.get(n.id) || 0;
      const row = columns[d].indexOf(n);
      positions.set(n.id, {
        x: dropX + (isVert ? row * CELL_W : d * CELL_W),
        y: dropY + (isVert ? d * CELL_H : row * CELL_H),
      });
    });

    // Build ID mapping and nodes
    const idMap = new Map();
    mod.nodes.forEach((n) => { idMap.set(n.id, `node_${generateId()}`); });

    const buildGroups = (n) => {
      if (n.type === 'checkpoint') return [];
      if (n.type === 'decision') {
        const outputs = (n.outputs || ['Yes', 'No']).map((lbl) => ({ id: `o_${generateId()}`, label: lbl }));
        return [{ id: `g_${generateId()}`, inputLabel: 'Input', outputs }];
      }
      // work_package
      const inputLabel = n.inputs?.[0] || 'Input';
      const outputs = (n.outputs || [n.label]).map((lbl) => ({ id: `o_${generateId()}`, label: lbl }));
      return [{ id: `g_${generateId()}`, inputLabel, outputs }];
    };

    const rfType = (t) => t === 'decision' ? 'decision' : t === 'checkpoint' ? 'checkpoint' : 'workPackage';

    const newNodes = mod.nodes.map((n) => ({
      id: idMap.get(n.id),
      type: rfType(n.type),
      position: positions.get(n.id),
      data: {
        label: n.label,
        nodeType: n.type || 'work_package',
        stage: dropStage,
        role: n.role || null,
        status: 'pending',
        notes: '',
        target_date: null,
        linked_docs: [],
        typical_inputs: [],
        groups: buildGroups(n),
        history: [{ event: 'created', timestamp: new Date().toISOString() }],
      },
    }));

    // Build edges — match output by label if specified, else first output
    const newEdges = mod.edges.map((edge) => {
      const srcId = idMap.get(edge.source);
      const tgtId = idMap.get(edge.target);
      const srcNode = newNodes.find((n) => n.id === srcId);
      const tgtNode = newNodes.find((n) => n.id === tgtId);

      let sourceHandle = 'output';
      let targetHandle = 'input';
      if (srcNode?.data.groups?.length) {
        const g = srcNode.data.groups[0];
        // Match by edge label if provided (for decision outputs like "Yes", "No")
        let matchedOut = edge.label
          ? g.outputs.find((o) => o.label === edge.label)
          : null;
        sourceHandle = `output-${g.id}-${(matchedOut || g.outputs[0])?.id}`;
      }
      if (tgtNode?.data.groups?.length) {
        const g = tgtNode.data.groups[0];
        targetHandle = `input-${g.id}`;
      }

      return {
        id: `edge_${generateId()}`,
        source: srcId,
        sourceHandle,
        target: tgtId,
        targetHandle,
        type: 'deletable',
        data: { loop: edge.loop || false },
      };
    });

    const moduleRecord = {
      id: `m_${generateId()}`,
      label: mod.label,
      members: newNodes.map((n) => n.id),
      padding: 40,
      fill: 'rgba(58,107,82,0.04)',
      stroke: '#c8c4bc',
    };

    importModuleNodes(newNodes, newEdges, moduleRecord);

    // Switch to the module's stage
    if (dropStage !== currentStage && !viewAll) {
      setCurrentStage(dropStage);
    }
  }, [viewport, currentStage, setCurrentStage, importModuleNodes]);

  // Chevron navigation
  const currentIdx = stageKeys.indexOf(String(currentStage));
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < stageKeys.length - 1;
  const prevLabel = hasPrev ? `S${stageKeys[currentIdx - 1]}` : '';
  const nextLabel = hasNext ? `S${stageKeys[currentIdx + 1]}` : '';

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#1a1a2e' }}>
      {/* Mega stage number underlay — sits behind everything */}
      {!viewAll && <MegaStageNumber currentStage={currentStage} stageKeys={stageKeys} />}

      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onNodeDragStop={readOnly ? undefined : (_, draggedNode) => {
          const SNAP_THRESHOLD = 15;
          const storeState = useProjectStore.getState();
          const storeNodes = storeState.nodes;
          const pos = draggedNode.position;
          let snapX = pos.x;
          let snapY = pos.y;
          let snappedX = false;
          let snappedY = false;

          for (const other of storeNodes) {
            if (other.id === draggedNode.id) continue;
            // Snap X alignment (left edges align)
            if (!snappedX && Math.abs(other.position.x - pos.x) < SNAP_THRESHOLD) {
              snapX = other.position.x;
              snappedX = true;
            }
            // Snap X alignment (right edges align — using measured widths)
            if (!snappedX) {
              const dragW = draggedNode.measured?.width || 180;
              const otherW = other.measured?.width || other.width || 180;
              const dragRight = pos.x + dragW;
              const otherRight = other.position.x + otherW;
              if (Math.abs(dragRight - otherRight) < SNAP_THRESHOLD) {
                snapX = otherRight - dragW;
                snappedX = true;
              }
            }
            // Snap Y alignment (top edges align)
            if (!snappedY && Math.abs(other.position.y - pos.y) < SNAP_THRESHOLD) {
              snapY = other.position.y;
              snappedY = true;
            }
            // Snap center-Y alignment
            if (!snappedY) {
              const dragH = draggedNode.measured?.height || 60;
              const otherH = other.measured?.height || other.height || 60;
              const dragCenterY = pos.y + dragH / 2;
              const otherCenterY = other.position.y + otherH / 2;
              if (Math.abs(dragCenterY - otherCenterY) < SNAP_THRESHOLD) {
                snapY = otherCenterY - dragH / 2;
                snappedY = true;
              }
            }
            if (snappedX && snappedY) break;
          }

          if (snappedX || snappedY) {
            useProjectStore.setState((state) => ({
              nodes: state.nodes.map((n) =>
                n.id === draggedNode.id
                  ? { ...n, position: { x: snapX, y: snapY } }
                  : n
              ),
            }));
          }
        }}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onConnectStart={readOnly ? undefined : onConnectStart}
        onConnectEnd={readOnly ? undefined : onConnectEnd}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onViewportChange={setViewport}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        snapToGrid={false}
        deleteKeyCode={readOnly ? null : 'Backspace'}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        style={{ background: 'transparent', zIndex: 1 }}
      >
        <Background gap={20} size={1} color="#2a2a3e" style={{ opacity: 0.5 }} />
      </ReactFlow>

      {/* Module background rectangles — behind nodes */}
      <ModuleBackgrounds modules={modules} nodes={nodes} viewport={viewport}
        onModuleClick={(mod) => selectModuleMembers(mod)}
        onModuleDragStart={(e, mod) => {
          const startX = e.clientX;
          const startY = e.clientY;
          const zoom = useProjectStore.getState().canvasZoom || 1;
          // Snapshot starting positions of all member nodes
          const startPositions = {};
          const currentNodes = useProjectStore.getState().nodes;
          mod.members.forEach((nid) => {
            const n = currentNodes.find((nd) => nd.id === nid);
            if (n) startPositions[nid] = { x: n.position.x, y: n.position.y };
          });

          const onMouseMove = (me) => {
            const dx = (me.clientX - startX) / zoom;
            const dy = (me.clientY - startY) / zoom;
            useProjectStore.setState((state) => ({
              nodes: state.nodes.map((n) => {
                if (startPositions[n.id]) {
                  return { ...n, position: { x: startPositions[n.id].x + dx, y: startPositions[n.id].y + dy } };
                }
                return n;
              }),
            }));
          };

          const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
          };

          document.body.style.cursor = 'grabbing';
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        }}
      />

      {/* Edge chevrons — appear on hover */}
      <EdgeChevron
        side="left"
        visible={hasPrev}
        label={prevLabel}
        onClick={() => hasPrev && setCurrentStage(parseInt(stageKeys[currentIdx - 1]))}
      />
      <EdgeChevron
        side="right"
        visible={hasNext}
        label={nextLabel}
        onClick={() => hasNext && setCurrentStage(parseInt(stageKeys[currentIdx + 1]))}
      />

      {/* Module action bar — only show "Group as Module" when nodes are NOT already grouped */}
      {selectedNodeIds.size >= 2 && !readOnly && (() => {
        // Check if all selected nodes belong to the same existing module
        const selectedArr = [...selectedNodeIds];
        const containingModule = modules.find((m) =>
          selectedArr.every((nid) => m.members.includes(nid))
        );

        if (containingModule) {
          // Already a module — show "Move Module" info, no create button
          return (
            <div style={{
              position: 'absolute',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}>
              <div style={{
                padding: '8px 16px',
                background: '#2a2a3e',
                color: '#d1d5db',
                borderRadius: 6,
                fontSize: 11,
                border: '1px solid #3a3a4e',
              }}>
                {containingModule.label} — drag any node to move group
              </div>
              <button
                onClick={exportSnippet}
                style={{
                  padding: '8px 12px',
                  background: '#2a2a3e',
                  color: '#60a5fa',
                  border: '1px solid #3a3a4e',
                  borderRadius: 6,
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Export Snippet
              </button>
              <button
                onClick={() => setSelectedNodeIds(new Set())}
                style={{
                  padding: '8px 12px',
                  background: '#2a2a3e',
                  color: '#9ca3af',
                  border: '1px solid #3a3a4e',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Deselect
              </button>
            </div>
          );
        }

        // Not in a module — offer to create one
        return (
          <div style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}>
            <button
              onClick={() => {
                const label = prompt('Module label:');
                if (!label || !label.trim()) return;
                addModule({
                  id: `m_${generateId()}`,
                  label: label.trim(),
                  members: [...selectedNodeIds],
                  padding: 40,
                  fill: 'rgba(58,107,82,0.04)',
                  stroke: '#c8c4bc',
                });
                setSelectedNodeIds(new Set());
              }}
              style={{
                padding: '8px 16px',
                background: '#f59e0b',
                color: '#1e1e2e',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              Group as Module ({selectedNodeIds.size} nodes)
            </button>
            <button
              onClick={exportSnippet}
              style={{
                padding: '8px 12px',
                background: '#2a2a3e',
                color: '#60a5fa',
                border: '1px solid #3a3a4e',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Export Snippet
            </button>
            <button
              onClick={() => setSelectedNodeIds(new Set())}
              style={{
                padding: '8px 12px',
                background: '#2a2a3e',
                color: '#9ca3af',
                border: '1px solid #3a3a4e',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
              }}
          >
            Cancel
          </button>
        </div>
        );
      })()}
    </div>
  );
}

export default function Canvas() {
  const stages = useProjectStore((s) => s.project.project.stages);
  const selectedNode = useProjectStore((s) => s.selectedNode);
  const deselectNode = useProjectStore((s) => s.deselectNode);
  const readOnly = useProjectStore((s) => s.readOnly);
  const projectVersion = useProjectStore((s) => s.projectVersion);

  const stageKeys = Object.keys(stages).sort((a, b) => parseInt(a) - parseInt(b));
  const firstAppt = stageKeys.find((k) => stages[k]?.in_appointment) || stageKeys[0] || '0';
  const [currentStage, setCurrentStage] = useState(parseInt(firstAppt));
  const [addMode, setAddMode] = useState(null);
  const [viewAll, setViewAll] = useState(false);

  // Reset to first in-appointment stage on project import
  useEffect(() => {
    const newFirst = stageKeys.find((k) => stages[k]?.in_appointment) || stageKeys[0] || '0';
    setCurrentStage(parseInt(newFirst));
  }, [projectVersion]);

  // Sync currentStage to store so edge components can read it
  useEffect(() => {
    useProjectStore.setState({ currentStage, viewAll });
  }, [currentStage, viewAll]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setAddMode(null);
        deselectNode();
      }
      if (e.key === 'ArrowLeft' && !e.target.closest('input, textarea, select')) {
        setCurrentStage((prev) => {
          const idx = stageKeys.indexOf(String(prev));
          return idx > 0 ? parseInt(stageKeys[idx - 1]) : prev;
        });
      }
      if (e.key === 'ArrowRight' && !e.target.closest('input, textarea, select')) {
        setCurrentStage((prev) => {
          const idx = stageKeys.indexOf(String(prev));
          return idx < stageKeys.length - 1 ? parseInt(stageKeys[idx + 1]) : prev;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deselectNode, stageKeys]);

  const sidebarSide = useProjectStore((s) => s.sidebarSide);
  const isLeft = sidebarSide === 'left';
  const panelW = (!readOnly || selectedNode) ? 280 : 0;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: isLeft ? panelW : 0,
        right: isLeft ? 0 : panelW,
        bottom: 0,
        transition: 'left 0.2s ease, right 0.2s ease',
      }}>
        <CanvasInner
          key={projectVersion}
          currentStage={currentStage}
          setCurrentStage={setCurrentStage}
          addMode={addMode}
          setAddMode={setAddMode}
          stages={stages}
          viewAll={viewAll}
        />
        <StageNav currentStage={currentStage} stages={stages} onSelect={(s) => { setViewAll(false); setCurrentStage(s); }} viewAll={viewAll} onToggleViewAll={() => setViewAll(!viewAll)} />
      </div>

      <PropertiesPanel addMode={addMode} setAddMode={setAddMode} />

      {addMode && (
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: isLeft ? panelW : 0,
          right: isLeft ? 0 : panelW,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 20,
          pointerEvents: 'none',
        }}>
          <div style={{
            background: '#1e40af',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 13,
            pointerEvents: 'auto',
          }}>
            Click on the canvas to place a {addMode.replace(/_/g, ' ')}. Press Esc to cancel.
          </div>
        </div>
      )}
    </div>
  );
}
