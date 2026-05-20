'use client';

import { Plus, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { FieldMeta } from '@/types/connector';

export interface ColumnPair {
  sfField: string;
  nsField: string;
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

  const addPair = () => onChange([...pairs, { sfField: '', nsField: '' }]);
  const removePair = (index: number) => onChange(pairs.filter((_, i) => i !== index));
  const updatePair = (index: number, side: 'sfField' | 'nsField', value: string) => {
    const next = [...pairs];
    next[index] = { ...next[index], [side]: value };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-3 gap-y-2 items-center">
        <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">{sfLabel}</span>
        <span />
        <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">{nsLabel}</span>
        <span />
        {pairs.map((pair, idx) => (
          <>
            {sfFreeText ? (
              <Input
                key={`sf-${idx}`}
                value={pair.sfField}
                onChange={(e) => updatePair(idx, 'sfField', e.target.value)}
                placeholder="Column name…"
                className="font-mono text-sm h-9"
              />
            ) : (
              <SearchableSelect
                key={`sf-${idx}`}
                value={pair.sfField}
                onValueChange={(v) => updatePair(idx, 'sfField', v)}
                options={sfOptions}
                placeholder="Salesforce field…"
                searchPlaceholder="Search fields…"
              />
            )}
            <ArrowRight key={`arrow-${idx}`} className="w-4 h-4 text-slate-400 flex-shrink-0" />
            {nsFreeText ? (
              <Input
                key={`ns-${idx}`}
                value={pair.nsField}
                onChange={(e) => updatePair(idx, 'nsField', e.target.value)}
                placeholder="Column name…"
                className="font-mono text-sm h-9"
              />
            ) : (
              <SearchableSelect
                key={`ns-${idx}`}
                value={pair.nsField}
                onValueChange={(v) => updatePair(idx, 'nsField', v)}
                options={nsOptions}
                placeholder="NetSuite field…"
                searchPlaceholder="Search fields…"
              />
            )}
            <Button
              key={`rm-${idx}`}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-red-500"
              onClick={() => removePair(idx)}
            >
              <X className="w-4 h-4" />
            </Button>
          </>
        ))}
      </div>

      {pairs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 border border-dashed rounded-lg bg-slate-50">
          <p className="text-sm">No column pairs yet — add a pair to compare SF and NS fields.</p>
        </div>
      )}

      <Button variant="outline" size="sm" className="gap-2" onClick={addPair}>
        <Plus className="w-4 h-4" /> Add pair
      </Button>
    </div>
  );
}
