import { getDb } from '@/lib/mongodb';

export type AIProvider = 'gemini' | 'claude' | 'openai';

export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: 'Gemini',
  claude: 'Claude',
  openai: 'ChatGPT',
};

export interface AISettingsDoc {
  provider: AIProvider;
  geminiModel: string;
  claudeModel: string;
  openaiModel: string;
}

export const AI_SETTINGS_DEFAULTS: AISettingsDoc = {
  provider: 'gemini',
  geminiModel: 'gemini-2.5-flash',
  claudeModel: 'claude-sonnet-4-6',
  openaiModel: 'gpt-4o',
};

export async function getAISettings(): Promise<AISettingsDoc> {
  try {
    const db = await getDb();
    const doc = await db.collection<AISettingsDoc & { key: string }>('app_settings').findOne({ key: 'ai_settings' });
    if (!doc) return { ...AI_SETTINGS_DEFAULTS };
    const valid = (v: unknown): v is AIProvider => v === 'gemini' || v === 'claude' || v === 'openai';
    return {
      provider: valid(doc.provider) ? doc.provider : AI_SETTINGS_DEFAULTS.provider,
      geminiModel: doc.geminiModel || AI_SETTINGS_DEFAULTS.geminiModel,
      claudeModel: doc.claudeModel || AI_SETTINGS_DEFAULTS.claudeModel,
      openaiModel: doc.openaiModel || AI_SETTINGS_DEFAULTS.openaiModel,
    };
  } catch {
    return { ...AI_SETTINGS_DEFAULTS };
  }
}

export async function saveAISettings(settings: Partial<AISettingsDoc>): Promise<void> {
  const db = await getDb();
  await db.collection('app_settings').updateOne(
    { key: 'ai_settings' },
    { $set: { key: 'ai_settings', ...settings, updatedAt: new Date() } },
    { upsert: true }
  );
}
