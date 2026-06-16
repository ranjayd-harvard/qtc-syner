'use client';

import { useState } from 'react';
import { Sparkles, Bot, Zap, CheckCircle2, XCircle, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type AIProvider = 'gemini' | 'claude' | 'openai';

interface AISettings {
  provider: AIProvider;
  geminiModel: string;
  claudeModel: string;
  openaiModel: string;
  geminiKeySet: boolean;
  claudeKeySet: boolean;
  openaiKeySet: boolean;
}

async function fetchSettings(): Promise<AISettings> {
  const res = await fetch('/api/admin/settings');
  if (!res.ok) throw new Error('Failed to load settings');
  return res.json() as Promise<AISettings>;
}

async function updateSettings(settings: Partial<AISettings>): Promise<AISettings> {
  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json() as Promise<AISettings>;
}

const PROVIDERS: { id: AIProvider; label: string; description: string; icon: React.ReactNode; envKey: string }[] = [
  {
    id: 'gemini',
    label: 'Gemini',
    description: 'Google\'s Gemini model family. Default: gemini-2.5-flash.',
    icon: <Sparkles className="w-5 h-5 text-blue-500" />,
    envKey: 'GEMINI_API_KEY',
  },
  {
    id: 'claude',
    label: 'Claude',
    description: 'Anthropic\'s Claude model family. Default: claude-sonnet-4-6.',
    icon: <Bot className="w-5 h-5 text-orange-500" />,
    envKey: 'CLAUDE_API_KEY',
  },
  {
    id: 'openai',
    label: 'ChatGPT',
    description: 'OpenAI\'s GPT model family. Default: gpt-4o.',
    icon: <Zap className="w-5 h-5 text-emerald-500" />,
    envKey: 'OPENAI_API_KEY',
  },
];

const MODEL_FIELDS: { provider: AIProvider; key: keyof AISettings; label: string; placeholder: string }[] = [
  { provider: 'gemini', key: 'geminiModel', label: 'Gemini model', placeholder: 'gemini-2.5-flash' },
  { provider: 'claude', key: 'claudeModel', label: 'Claude model', placeholder: 'claude-sonnet-4-6' },
  { provider: 'openai', key: 'openaiModel', label: 'OpenAI model', placeholder: 'gpt-4o' },
];

export default function AISettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['ai-settings'], queryFn: fetchSettings });

  const [draft, setDraft] = useState<Partial<AISettings>>({});
  const [saved, setSaved] = useState(false);

  const current = { ...data, ...draft } as AISettings;

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (updated) => {
      qc.setQueryData(['ai-settings'], updated);
      setDraft({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const handleSave = () => {
    mutation.mutate(draft);
  };

  const isDirty = Object.keys(draft).length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Provider Settings</h1>
        <p className="text-slate-500 text-sm mt-1">
          Choose which AI model powers the Entity Syncer analysis, semantic matching, and explain features.
        </p>
      </div>

      {/* Provider selection */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-slate-700">Active provider</Label>
        <div className="space-y-2">
          {PROVIDERS.map((p) => {
            const keySet = data?.[`${p.id}KeySet` as keyof AISettings] as boolean | undefined;
            const isActive = current.provider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, provider: p.id }))}
                className={[
                  'w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all',
                  isActive
                    ? 'border-indigo-500 bg-indigo-50/60'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                ].join(' ')}
              >
                <div className={[
                  'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5',
                  isActive ? 'bg-indigo-100' : 'bg-slate-100',
                ].join(' ')}>
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{p.label}</span>
                    {isActive && (
                      <Badge className="text-xs bg-indigo-600 text-white border-0 py-0">Active</Badge>
                    )}
                    {keySet ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 ml-auto">
                        <CheckCircle2 className="w-3.5 h-3.5" /> API key set
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-600 ml-auto">
                        <XCircle className="w-3.5 h-3.5" /> {p.envKey} not set
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{p.description}</p>
                </div>
                <div className={[
                  'flex-shrink-0 w-4 h-4 rounded-full border-2 mt-1',
                  isActive ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300',
                ].join(' ')} />
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400">
          API keys must be set in your <code className="bg-slate-100 px-1 rounded">.env</code> file and require a container restart to take effect.
        </p>
      </div>

      {/* Model names */}
      <div className="space-y-4">
        <Label className="text-sm font-semibold text-slate-700">Model overrides</Label>
        <p className="text-xs text-slate-400 -mt-2">Leave blank to use the default model for each provider.</p>
        <div className="space-y-3">
          {MODEL_FIELDS.map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label htmlFor={f.key} className="text-xs text-slate-600 flex items-center gap-2">
                {f.label}
                {current.provider === f.provider && (
                  <Badge variant="secondary" className="text-xs py-0 px-1.5">in use</Badge>
                )}
              </Label>
              <Input
                id={f.key}
                value={(draft[f.key] as string | undefined) ?? (data?.[f.key] as string | undefined) ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="font-mono text-sm h-9"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
        <Button
          onClick={handleSave}
          disabled={!isDirty || mutation.isPending}
          className="gap-2"
        >
          {mutation.isPending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : saved ? (
            <><CheckCircle2 className="w-4 h-4" /> Saved</>
          ) : (
            <><Save className="w-4 h-4" /> Save changes</>
          )}
        </Button>
        {isDirty && !mutation.isPending && (
          <Button variant="ghost" size="sm" onClick={() => setDraft({})}>
            Discard
          </Button>
        )}
        {mutation.isError && (
          <p className="text-sm text-red-600">{String(mutation.error)}</p>
        )}
      </div>
    </div>
  );
}
