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

export interface FieldMapping {
  sourceField: string;
  targetField: string;
}

interface SchemaMapperCanvasProps {
  sourceFields: FieldMeta[];
  targetFields: FieldMeta[];
  sourceLabel: string;
  targetLabel: string;
  initialMappings: FieldMapping[];
  onChange: (mappings: FieldMapping[]) => void;
}

const nodeTypes = { fieldNode: FieldNode };

const COLUMN_GAP = 480;
const ROW_HEIGHT = 60;
const SOURCE_X = 50;
const TARGET_X = SOURCE_X + COLUMN_GAP;

// Show headers at top with both columns visible; user scrolls down for more fields.
// At zoom 0.85: SOURCE_X=50→42px, TARGET_X=530→450px — fits in most canvases.
// y=64 puts header (canvas y=-52) at ~20px from top: 20 + 52*0.85 ≈ 64
const DEFAULT_VIEWPORT = { x: 20, y: 64, zoom: 0.85 };

const CANVAS_STYLES = `
  .react-flow__edge-path { cursor: pointer; transition: stroke 0.1s, stroke-width 0.1s; }
  .react-flow__edge.selected .react-flow__edge-path {
    stroke: #f59e0b !important;
    stroke-width: 3px !important;
    stroke-dasharray: 8 4 !important;
  }
  .react-flow__edge:hover .react-flow__edge-path { stroke-width: 3px !important; opacity: 0.8; }
`;

function buildNodes(
  sourceFields: FieldMeta[],
  targetFields: FieldMeta[],
  sourceLabel: string,
  targetLabel: string
): Node[] {
  const headerStyle = {
    fontSize: 11, fontWeight: 700, padding: '5px 12px',
    borderRadius: 6, border: '1px solid', width: 210,
  };
  return [
    {
      id: 'header-source', type: 'default',
      position: { x: SOURCE_X, y: -52 },
      data: { label: sourceLabel }, draggable: false, selectable: false,
      style: { ...headerStyle, background: '#e0e7ff', borderColor: '#a5b4fc', color: '#3730a3' },
    },
    {
      id: 'header-target', type: 'default',
      position: { x: TARGET_X, y: -52 },
      data: { label: targetLabel }, draggable: false, selectable: false,
      style: { ...headerStyle, background: '#ede9fe', borderColor: '#c4b5fd', color: '#5b21b6' },
    },
    ...sourceFields.map((field, i) => ({
      id: `src-${field.name}`, type: 'fieldNode' as const,
      position: { x: SOURCE_X, y: i * ROW_HEIGHT },
      data: { field, side: 'source' } satisfies FieldNodeData,
      draggable: false, selectable: false,
    })),
    ...targetFields.map((field, i) => ({
      id: `tgt-${field.name}`, type: 'fieldNode' as const,
      position: { x: TARGET_X, y: i * ROW_HEIGHT },
      data: { field, side: 'target' } satisfies FieldNodeData,
      draggable: false, selectable: false,
    })),
  ];
}

function buildEdges(initialMappings: FieldMapping[]): Edge[] {
  return initialMappings.map((m) => ({
    id: `edge-${m.sourceField}-${m.targetField}`,
    source: `src-${m.sourceField}`, sourceHandle: 'out',
    target: `tgt-${m.targetField}`, targetHandle: 'in',
    style: { stroke: '#6366f1', strokeWidth: 2 },
  }));
}

function edgesToMappings(edges: Edge[]): FieldMapping[] {
  return edges
    .filter((e) => e.source.startsWith('src-') && e.target.startsWith('tgt-'))
    .map((e) => ({ sourceField: e.source.slice(4), targetField: e.target.slice(4) }));
}

function FitButton() {
  const { fitView } = useReactFlow();
  return (
    <button
      onClick={() => fitView({ padding: 0.15, duration: 350 })}
      title="Fit all nodes into view"
      className="flex items-center gap-1.5 bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
    >
      <Maximize2 className="w-3 h-3" /> Fit view
    </button>
  );
}

function MappingCanvas({
  nodes, edges, onNodesChange, onEdgesChange, onConnect,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: Parameters<typeof ReactFlow>[0]['onNodesChange'];
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
}) {
  return (
    <ReactFlow
      nodes={nodes} edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
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
        nodeColor={(n) => String(n.id).startsWith('src-') ? '#6366f1' : '#8b5cf6'}
        nodeStrokeWidth={0}
        nodeBorderRadius={2}
        maskColor="rgba(99,102,241,0.12)"
        style={{
          width: 200,
          height: 130,
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
        <div className="bg-white border border-slate-200 rounded-full px-3 py-1 text-xs text-slate-500 shadow-sm">
          {edges.length} {edges.length === 1 ? 'mapping' : 'mappings'}
          {' · '}drag handle to connect{' · '}click edge then Delete to remove
        </div>
      </Panel>
    </ReactFlow>
  );
}

export function SchemaMapperCanvas({
  sourceFields, targetFields, sourceLabel, targetLabel, initialMappings, onChange,
}: SchemaMapperCanvasProps) {
  const initialNodes = buildNodes(sourceFields, targetFields, sourceLabel, targetLabel);
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
      setEdges((eds) => {
        const newEdges = addEdge({ ...connection, style: { stroke: '#6366f1', strokeWidth: 2 } }, eds);
        onChange(edgesToMappings(newEdges));
        return newEdges;
      });
    },
    [setEdges, onChange]
  );

  return (
    <>
      <style>{CANVAS_STYLES}</style>
      <div style={{ height: 600 }} className="border rounded-lg overflow-hidden bg-slate-50">
        <MappingCanvas
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
        />
      </div>
    </>
  );
}
