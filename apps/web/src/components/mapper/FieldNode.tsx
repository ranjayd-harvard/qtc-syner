'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Key } from 'lucide-react';
import type { FieldMeta } from '@/types/connector';

export interface FieldNodeData extends Record<string, unknown> {
  field: FieldMeta;
  // 'middle' nodes (Level 2 in multi-level mapping) get handles on both sides
  side: 'source' | 'target' | 'middle';
}

const TYPE_COLOR: Record<string, string> = {
  string: 'bg-blue-50 text-blue-700',
  varchar: 'bg-blue-50 text-blue-700',
  text: 'bg-blue-50 text-blue-700',
  int: 'bg-violet-50 text-violet-700',
  integer: 'bg-violet-50 text-violet-700',
  bigint: 'bg-violet-50 text-violet-700',
  numeric: 'bg-violet-50 text-violet-700',
  boolean: 'bg-amber-50 text-amber-700',
  date: 'bg-emerald-50 text-emerald-700',
  timestamp: 'bg-emerald-50 text-emerald-700',
  datetime: 'bg-emerald-50 text-emerald-700',
  picklist: 'bg-pink-50 text-pink-700',
  reference: 'bg-orange-50 text-orange-700',
};

function typeColor(type: string): string {
  return TYPE_COLOR[type.toLowerCase()] ?? 'bg-slate-100 text-slate-600';
}

export function FieldNode({ data }: NodeProps) {
  const { field, side } = data as FieldNodeData;
  return (
    <div
      style={{ width: 210 }}
      className="relative rounded border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm flex items-center gap-1.5 select-none hover:border-indigo-300 hover:shadow-md transition-all duration-100"
    >
      {(side === 'target' || side === 'middle') && (
        <Handle
          id="in"
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white"
        />
      )}
      {field.isPrimary && (
        <Key className="w-3 h-3 text-amber-500 flex-shrink-0" />
      )}
      <span className="font-mono truncate flex-1 text-slate-800">{field.name}</span>
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium flex-shrink-0 ${typeColor(field.type)}`}
      >
        {field.type}
      </span>
      {(side === 'source' || side === 'middle') && (
        <Handle
          id="out"
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-white"
        />
      )}
    </div>
  );
}
