import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { Part, Schema, FunctionDeclarationSchema } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { ChatCompletionTool, ChatCompletionMessageParam, ChatCompletionMessageFunctionToolCall } from 'openai/resources/chat';
import { getAISettings } from '@/models/AppSettings';
import type { AIProvider } from '@/models/AppSettings';

export type { AIProvider } from '@/models/AppSettings';

// ── Shared schema / tool types ────────────────────────────────────────────────

export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
}

export interface ToolParam {
  name: string;
  description: string;
  parameters: JSONSchema;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export type ToolHandler = (call: ToolCall) => Promise<unknown>;

// ── Internal AI context (reads DB settings + env keys) ────────────────────────

interface AIContext {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

async function getAIContext(): Promise<AIContext> {
  const settings = await getAISettings();
  const { provider } = settings;

  if (provider === 'claude') {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) throw new Error('CLAUDE_API_KEY is not configured. Add it to your .env file.');
    return { provider, apiKey, model: settings.claudeModel };
  }
  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured. Add it to your .env file.');
    return { provider, apiKey, model: settings.openaiModel };
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured. Add it to your .env file.');
  return { provider: 'gemini', apiKey, model: settings.geminiModel };
}

// ── Gemini schema conversion ──────────────────────────────────────────────────

function toGeminiSchema(s: JSONSchema): Schema {
  const typeMap: Record<string, SchemaType> = {
    object: SchemaType.OBJECT,
    array: SchemaType.ARRAY,
    string: SchemaType.STRING,
    number: SchemaType.NUMBER,
    integer: SchemaType.INTEGER,
    boolean: SchemaType.BOOLEAN,
  };
  return {
    type: typeMap[s.type],
    ...(s.description && { description: s.description }),
    ...(s.properties !== undefined && {
      properties: Object.fromEntries(
        Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)])
      ),
    }),
    ...(s.items && { items: toGeminiSchema(s.items) }),
    ...(s.required?.length && { required: s.required }),
  } as unknown as Schema;
}

function toGeminiDeclarationSchema(s: JSONSchema): FunctionDeclarationSchema {
  const properties: Record<string, Schema> = {};
  if (s.properties) {
    for (const [k, v] of Object.entries(s.properties)) {
      properties[k] = toGeminiSchema(v);
    }
  }
  return {
    type: SchemaType.OBJECT,
    properties,
    ...(s.description && { description: s.description }),
    ...(s.required?.length && { required: s.required }),
  };
}

// ── Text generation ───────────────────────────────────────────────────────────

export async function generateText(prompt: string): Promise<string> {
  const { provider, apiKey, model } = await getAIContext();

  if (provider === 'claude') {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content.find((b) => b.type === 'text');
    return (block as Anthropic.TextBlock | undefined)?.text ?? '';
  }

  if (provider === 'openai') {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content ?? '';
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });
  const result = await geminiModel.generateContent(prompt);
  return result.response.text();
}

// ── Structured JSON generation ────────────────────────────────────────────────

export async function generateJSON<T>(prompt: string, schema: JSONSchema): Promise<T> {
  const { provider, apiKey, model } = await getAIContext();

  if (provider === 'claude') {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      tools: [{
        name: 'structured_response',
        description: 'Return your response as structured JSON matching the provided schema.',
        input_schema: schema as Anthropic.Tool['input_schema'],
      }],
      tool_choice: { type: 'tool', name: 'structured_response' },
      messages: [{ role: 'user', content: prompt }],
    });
    const block = response.content.find((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined;
    return (block?.input ?? {}) as T;
  }

  if (provider === 'openai') {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant. Respond ONLY with a valid JSON object matching this schema:\n${JSON.stringify(schema, null, 2)}`,
        },
        { role: 'user', content: prompt },
      ],
    });
    return JSON.parse(response.choices[0].message.content ?? '{}') as T;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(schema),
    },
  });
  const result = await geminiModel.generateContent(prompt);
  return JSON.parse(result.response.text()) as T;
}

// ── Agentic tool-call loop ────────────────────────────────────────────────────

export async function runAgenticLoop(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  tools: ToolParam[],
  toolHandler: ToolHandler,
): Promise<{ reply: string }> {
  const ctx = await getAIContext();
  if (ctx.provider === 'claude') return runClaudeLoop(messages, systemPrompt, tools, toolHandler, ctx);
  if (ctx.provider === 'openai') return runOpenAILoop(messages, systemPrompt, tools, toolHandler, ctx);
  return runGeminiLoop(messages, systemPrompt, tools, toolHandler, ctx);
}

async function runGeminiLoop(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  tools: ToolParam[],
  toolHandler: ToolHandler,
  { apiKey, model }: AIContext,
): Promise<{ reply: string }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemPrompt,
    tools: [{
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: toGeminiDeclarationSchema(t.parameters),
      })),
    }],
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'user' ? ('user' as const) : ('model' as const),
    parts: [{ text: m.content }],
  }));

  const chat = geminiModel.startChat({ history });
  let result = await chat.sendMessage(messages[messages.length - 1].content);

  while (true) {
    const calls = result.response.functionCalls();
    if (!calls?.length) break;

    const toolResponses = await Promise.all(
      calls.map(async (call) => {
        const response = await toolHandler({ name: call.name, args: call.args as Record<string, unknown> });
        return { functionResponse: { name: call.name, response: response as object } } as Part;
      })
    );

    result = await chat.sendMessage(toolResponses);
  }

  return { reply: result.response.text() };
}

async function runClaudeLoop(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  tools: ToolParam[],
  toolHandler: ToolHandler,
  { apiKey, model }: AIContext,
): Promise<{ reply: string }> {
  const anthropic = new Anthropic({ apiKey });

  const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool['input_schema'],
  }));

  let msgs: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  while (true) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 8096,
      system: systemPrompt,
      tools: anthropicTools,
      messages: msgs,
    });

    if (response.stop_reason !== 'tool_use') {
      const textBlock = response.content.find((b) => b.type === 'text') as Anthropic.TextBlock | undefined;
      return { reply: textBlock?.text ?? '' };
    }

    msgs.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      response.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        .map(async (block) => {
          const res = await toolHandler({ name: block.name, args: block.input as Record<string, unknown> });
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: JSON.stringify(res),
          };
        })
    );

    msgs.push({ role: 'user', content: toolResults });
  }
}

async function runOpenAILoop(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string,
  tools: ToolParam[],
  toolHandler: ToolHandler,
  { apiKey, model }: AIContext,
): Promise<{ reply: string }> {
  const openai = new OpenAI({ apiKey });

  const openaiTools: ChatCompletionTool[] = tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as unknown as Record<string, unknown>,
    },
  }));

  let msgs: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  while (true) {
    const response = await openai.chat.completions.create({
      model,
      messages: msgs,
      tools: openaiTools,
      tool_choice: 'auto',
    });

    const choice = response.choices[0];

    if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
      return { reply: choice.message.content ?? '' };
    }

    msgs.push(choice.message);

    for (const toolCall of choice.message.tool_calls) {
      if (toolCall.type !== 'function') continue;
      const fnCall = toolCall as ChatCompletionMessageFunctionToolCall;
      const args = JSON.parse(fnCall.function.arguments) as Record<string, unknown>;
      const res = await toolHandler({ name: fnCall.function.name, args });
      msgs.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(res),
      });
    }
  }
}
