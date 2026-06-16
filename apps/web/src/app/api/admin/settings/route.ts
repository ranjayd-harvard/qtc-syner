import { NextResponse } from 'next/server';
import { getAISettings, saveAISettings } from '@/models/AppSettings';
import type { AISettingsDoc } from '@/models/AppSettings';

export async function GET() {
  try {
    const settings = await getAISettings();
    return NextResponse.json({
      ...settings,
      geminiKeySet: !!process.env.GEMINI_API_KEY,
      claudeKeySet: !!process.env.CLAUDE_API_KEY,
      openaiKeySet: !!process.env.OPENAI_API_KEY,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json() as Partial<AISettingsDoc>;

    const allowed: (keyof AISettingsDoc)[] = ['provider', 'geminiModel', 'claudeModel', 'openaiModel'];
    const update: Partial<AISettingsDoc> = {};
    for (const key of allowed) {
      if (key in body && body[key] !== undefined) {
        (update as Record<string, unknown>)[key] = body[key];
      }
    }

    if (update.provider && !['gemini', 'claude', 'openai'].includes(update.provider)) {
      return NextResponse.json({ error: 'Invalid provider value' }, { status: 400 });
    }

    await saveAISettings(update);
    const saved = await getAISettings();
    return NextResponse.json({
      ...saved,
      geminiKeySet: !!process.env.GEMINI_API_KEY,
      claudeKeySet: !!process.env.CLAUDE_API_KEY,
      openaiKeySet: !!process.env.OPENAI_API_KEY,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
