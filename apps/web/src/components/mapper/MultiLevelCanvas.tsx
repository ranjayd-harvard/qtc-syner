'use client';

import '@xyflow/react/dist/style.css';

import { useCallback } from 'react';
import {
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
} from '@xyflow/react';
import { Maximize2 } from 'lucide-react';
import { FieldNode, type FieldNodeData } from './FieldNode';
import type { FieldMeta } from '@/types/connector';

export interface FieldMappingEntry {
  sourceField: string;
  targetField: string;
}

export interface MultiLevelMappings {
  l1ToL2: FieldMappingEntry[];
  l2ToL3: FieldMappingEntry[];
}

interface MultiLevelCanvasProps {
  l1Fields: FieldMeta[];
  l2Fields: FieldMeta[];
  l3Fields: FieldMeta[];
  l1Label: string;
  l2Label: string;
  l3Label: string;
  initialMappings: MultiLevelMappings;
  onChange: (mappings: MultiLevelMappings) => void;
}

const nodeTypes = { fieldNode: FieldNode };

const COL_X = [50, 400, 750] as const;
const ROW_HEIGHT = 60;

// Three columns span 0→960px. At zoom 0.65 that's ~624px — fits most screens.
// y=54 puts header (canvas y=-52) at ~20px from top: 20 + 52*0.65 ≈ 54
const DEFAULT_VIEWPORT = { x: 20, y: 54, zoom: 0.65 };

const CANVAS_STYLES = `
  .react-flow__edge-path { cursor: pointer; transition: stroke 0.1s, stroke-width 0.1s; }
  .react-flow__edge.selected .react-flow__edge-path {
    stroke: #f59e0b !important;
    stroke-width: 3px !important;
    stroke-dasharray: 8 4 !important;
  }
  .react-flow__edge:hover .react-flow__edge-path { stroke-width: 3px !important; opacity: 0.8; }
`;

const HEADER_STYLE_BASE = {
  fontSize: 11, fontWeight: 700, padding: '5px 12px',
  borderRadius: 6, border: '1px solid', width: 210,
};

const HEADER_STYLES = [
  { background: '#e0e7ff', borderColor: '#a5b4fc', color: '#3730a3' },
  { background: '#f0fdf4', borderColor: '#86efac', color: '#166534' },
  { background: '#ede9fe', borderColor: '#c4b5fd', color: '#5b21b6' },
] as const;

const EDGE_STYLES = [
  { stroke: '#6366f1', strokeWidth: 2 },
  { stroke: '#8b5cf6', strokeWidth: 2 },
] as const;

function buildNodes(
  l1Fields: FieldMeta[],
  l2Fields: FieldMeta[],
  l3Fields: FieldMeta[],
  labels: [string, string, string]
): Node[] {
  const headers: Node[] = labels.map((label, i) => ({
    id: `header-l${i + 1}`, type: 'default',
    position: { x: COL_X[i], y: -52 },
    data: { label: `Level ${i + 1}: ${label}` },
    draggable: false, selectable: false,
    style: { ...HEADER_STYLE_BASE, ...HEADER_STYLES[i] },
  }));

  const fieldSets: [FieldMeta[], string, 'source' | 'middle' | 'target'][] = [
    [l1Fields, 'l1', 'source'],
    [l2Fields, 'l2', 'middle'],
    [l3Fields, 'l3', 'target'],
  ];

  const fieldNodes: Node[] = fieldSets.flatMap(([fields, prefix, side], colIdx) =>
    fields.map((field, i) => ({
      id: `${prefix}-${field.name}`, type: 'fieldNode' as const,
      position: { x: COL_X[colIdx], y: i * ROW_HEIGHT },
      data: { field, side } satisfies FieldNodeData,
      draggable: false, selectable: false,
    }))
  );

  return [...headers, ...fieldNodes];
}

function buildEdges(initialMappings: MultiLevelMappings): Edge[] {
  return [
    ...initialMappings.l1ToL2.map((m) => ({
      id: `e-l1l2-${m.sourceField}-${m.targetField}`,
      source: `l1-${m.sourceField}`, sourceHandle: 'out',
      target: `l2-${m.targetField}`, targetHandle: 'in',
      style: EDGE_STYLES[0],
    })),
    ...initialMappings.l2ToL3.map((m) => ({
      id: `e-l2l3-${m.sourceField}-${m.targetField}`,
      source: `l2-${m.sourceField}`, sourceHandle: 'out',
      target: `l3-${m.targetField}`, targetHandle: 'in',
      style: EDGE_STYLES[1],
    })),
  ];
}

function edgesToMappings(edges: Edge[]): MultiLevelMappings {
  const l1ToL2: FieldMappingEntry[] = [];
  const l2ToL3: FieldMappingEntry[] = [];
  for (const e of edges) {
    if (e.source.startsWith('l1-') && e.target.startsWith('l2-'))
      l1ToL2.push({ sourceField: e.source.slice(3), targetField: e.target.slice(3) });
    else if (e.source.startsWith('l2-') && e.target.startsWith('l3-'))
      l2ToL3.push({ sourceField: e.source.slice(3), targetField: e.target.slice(3) });
  }
  return { l1ToL2, l2ToL3 };
}

function isValidConnection(connection: Connection | Edge): boolean {
  const src = connection.source ?? '';
  const tgt = connection.target ?? '';
  return (src.startsWith('l1-') && tgt.startsWith('l2-')) ||
         (src.startsWith('l2-') && tgt.startsWith('l3-'));
}

function FitButton() {
  const { fitView } = useReactFlow();
  return (
    <button
      onClick={() => fitView({ padding: 0.12, duration: 350 })}
      title="Fit all nodes into view"
      className="flex items-center gap-1.5 bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
    >
      <Maximize2 className="w-3 h-3" /> Fit view
    </button>
  );
}

function MultiCanvas({
  nodes, edges, onNodesChange, onEdgesChange, onConnect, l1l2Count, l2l3Count,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: Parameters<typeof ReactFlow>[0]['onNodesChange'];
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  l1l2Count: number;
  l2l3Count: number;
}) {
  return (
    <ReactFlow
      nodes={nodes} edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      isValidConnection={isValidConnection}
      nodeTypes={nodeTypes}
      defaultViewport={DEFAULT_VIEWPORT}
      deleteKeyCode={['Delete', 'Backspace']}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} color="#e2e8f0" />
      <Controls />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => {
          const id = String(n.id);
          if (id.startsWith('l1-') || id === 'header-l1') return '#6366f1';
          if (id.startsWith('l2-') || id === 'header-l2') return '#22c55e';
          return '#8b5cf6';
        }}
        nodeStrokeWidth={0}
        nodeBorderRadius={2}
        maskColor="rgba(99,102,241,0.12)"
        style={{
          width: 220,
          height: 140,
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}
      />
      <Panel position="top-right">
        <FitButton />
      </Panel>
      <Panel position="top-center">
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-full px-4 py-1.5 text-xs text-slate-500 shadow-sm">
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mr-1" />
            L1→L2: <strong className="text-slate-700">{l1l2Count}</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span>
            <span className="inline-block w-2 h-2 rounded-full bg-violet-500 mr-1" />
            L2→L3: <strong className="text-slate-700">{l2l3Count}</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span>{l1l2Count + l2l3Count} total · click edge then Delete to remove</span>
        </div>
      </Panel>
    </ReactFlow>
  );
}

export function MultiLevelCanvas({
  l1Fields, l2Fields, l3Fields, l1Label, l2Label, l3Label, initialMappings, onChange,
}: MultiLevelCanvasProps) {
  const initialNodes = buildNodes(l1Fields, l2Fields, l3Fields, [l1Label, l2Label, l3Label]);
  const initialEdges = buildEdges(initialMappings);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds);
        onChange(edgesToMappings(updated));
        return updated;
      });
    },
    [setEdges, onChange]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const style = connection.source?.startsWith('l1-') ? EDGE_STYLES[0] : EDGE_STYLES[1];
      setEdges((eds) => {
        const newEdges = addEdge({ ...connection, style }, eds);
        onChange(edgesToMappings(newEdges));
        return newEdges;
      });
    },
    [setEdges, onChange]
  );

  const l1l2Count = edges.filter((e) => e.source.startsWith('l1-') && e.target.startsWith('l2-')).length;
  const l2l3Count = edges.filter((e) => e.source.startsWith('l2-') && e.target.startsWith('l3-')).length;

  return (
    <>
      <style>{CANVAS_STYLES}</style>
      <div style={{ height: 640 }} className="border rounded-lg overflow-hidden bg-slate-50">
        <MultiCanvas
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          l1l2Count={l1l2Count}
          l2l3Count={l2l3Count}
        />
      </div>
    </>
  );
}
