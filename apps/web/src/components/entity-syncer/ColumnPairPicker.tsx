'use client';

import { useState } from 'react';
import { Plus, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { FieldMeta } from '@/types/connector';

export interface ColumnPair {
  sfFields: string[];
  nsFields: string[];
  condition: 'AND' | 'OR';
}

interface ColumnPairPickerProps {
  sfFields: FieldMeta[];
  nsFields: FieldMeta[];
  pairs: ColumnPair[];
  onChange: (pairs: ColumnPair[]) => void;
  sfFreeText?: boolean;
  nsFreeText?: boolean;
  sfLabel?: string;
  nsLabel?: string;
}

// Inline free-text input for adding a field by name when no schema is loaded
function FreeTextAdd({
  color,
  onAdd,
}: {
  color: 'indigo' | 'violet';
  onAdd: (field: string) => void;
}) {
  const [val, setVal] = useState('');
  const commit = () => {
    const trimmed = val.trim();
    if (trimmed) { onAdd(trimmed); setVal(''); }
  };
  const btnClass = color === 'indigo'
    ? 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
    : 'border-violet-200 text-violet-600 hover:bg-violet-50';

  return (
    <div className="flex items-center gap-1 mt-1">
      <Input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        placeholder="Column name…"
        className="font-mono text-xs h-7 flex-1"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`h-7 px-2 text-xs ${btnClass}`}
        onClick={commit}
        disabled={!val.trim()}
      >
        <Plus className="w-3 h-3" />
      </Button>
    </div>
  );
}

function FieldChip({
  field,
  color,
  onRemove,
}: {
  field: string;
  color: 'indigo' | 'violet';
  onRemove: () => void;
}) {
  const chipClass = color === 'indigo'
    ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
    : 'bg-violet-100 text-violet-700 border-violet-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono ${chipClass}`}>
      {field}
      <button type="button" onClick={onRemove} className="opacity-60 hover:opacity-100 ml-0.5">
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}

export function ColumnPairPicker({
  sfFields, nsFields, pairs, onChange,
  sfFreeText = false, nsFreeText = false,
  sfLabel = 'Salesforce field', nsLabel = 'NetSuite field',
}: ColumnPairPickerProps) {
  const sfOptions = sfFields.map((f) => ({
    value: f.name,
    label: f.label ? `${f.label} (${f.name})` : f.name,
  }));
  const nsOptions = nsFields.map((f) => ({
    value: f.name,
    label: f.label ? `${f.label} (${f.name})` : f.name,
  }));

  const addPair = () => onChange([...pairs, { sfFields: [], nsFields: [], condition: 'AND' }]);
  const removePair = (pairIdx: number) => onChange(pairs.filter((_, i) => i !== pairIdx));

  const updateCondition = (pairIdx: number, condition: 'AND' | 'OR') =>
    onChange(pairs.map((p, i) => i === pairIdx ? { ...p, condition } : p));

  const addField = (pairIdx: number, side: 'sfFields' | 'nsFields', field: string) => {
    if (!field) return;
    const next = pairs.map((p, i) => {
      if (i !== pairIdx) return p;
      if (p[side].includes(field)) return p;
      return { ...p, [side]: [...p[side], field] };
    });
    onChange(next);
  };

  const removeField = (pairIdx: number, side: 'sfFields' | 'nsFields', field: string) => {
    onChange(pairs.map((p, i) =>
      i === pairIdx ? { ...p, [side]: p[side].filter((f) => f !== field) } : p
    ));
  };

  const renderSide = (
    pair: ColumnPair,
    pairIdx: number,
    side: 'sfFields' | 'nsFields',
    options: { value: string; label: string }[],
    color: 'indigo' | 'violet',
    freeText: boolean,
  ) => {
    const selected = pair[side];
    const remaining = options.filter((o) => !selected.includes(o.value));

    return (
      <div className="space-y-1.5">
        {/* Selected field chips */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selected.map((f) => (
              <FieldChip
                key={f}
                field={f}
                color={color}
                onRemove={() => removeField(pairIdx, side, f)}
              />
            ))}
          </div>
        )}

        {/* Add field control */}
        {freeText ? (
          <FreeTextAdd color={color} onAdd={(v) => addField(pairIdx, side, v)} />
        ) : remaining.length > 0 ? (
          <SearchableSelect
            value=""
            onValueChange={(v) => addField(pairIdx, side, v)}
            options={remaining}
            placeholder={selected.length === 0 ? 'Select field…' : '+ Add another field…'}
            searchPlaceholder="Search fields…"
          />
        ) : selected.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No fields available</p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-3 items-center">
        <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">{sfLabel}</span>
        <span />
        <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">{nsLabel}</span>
        <span />
      </div>

      {/* Pair rows */}
      <div className="space-y-2">
        {pairs.map((pair, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-3 items-start rounded-lg border border-slate-100 bg-slate-50 p-3">
            {renderSide(pair, idx, 'sfFields', sfOptions, 'indigo', sfFreeText)}
            <div className="flex flex-col items-center gap-1 mt-1.5 flex-shrink-0">
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <div className="inline-flex rounded border border-slate-200 overflow-hidden text-xs">
                {(['AND', 'OR'] as const).map((cond, ci) => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => updateCondition(idx, cond)}
                    className={cn(
                      'px-2 py-0.5 font-semibold transition-colors',
                      ci > 0 && 'border-l border-slate-200',
                      pair.condition === cond
                        ? 'bg-slate-700 text-white'
                        : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                    )}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>
            {renderSide(pair, idx, 'nsFields', nsOptions, 'violet', nsFreeText)}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-red-500 self-start"
              onClick={() => removePair(idx)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {pairs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 border border-dashed rounded-lg bg-slate-50">
          <p className="text-sm">No column pairs yet — add a pair to define SF → NS field mappings.</p>
          <p className="text-xs mt-1 text-slate-300">Each pair can contain multiple fields on either side (composite key).</p>
        </div>
      )}

      <Button variant="outline" size="sm" className="gap-2" onClick={addPair}>
        <Plus className="w-4 h-4" /> Add pair
      </Button>
    </div>
  );
}
