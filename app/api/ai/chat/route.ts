import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { auth } from '@/lib/auth';
import { aiFunctionDeclarations, executeAIFunction } from '@/lib/ai/functions';

type GeminiModelListItem = {
  name?: string;
  supportedGenerationMethods?: string[];
};

type GeminiModelListResponse = {
  models?: GeminiModelListItem[];
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 2500;
const MAX_TOOL_RESULT_CHARS = 8000;

function normalizeConversationHistory(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];

  const cleaned = input
    .map((msg: any) => {
      const role = msg?.role;
      const content = typeof msg?.content === 'string' ? msg.content : '';
      if ((role !== 'user' && role !== 'assistant') || !content.trim()) return null;

      const trimmed = content.length > MAX_MESSAGE_CHARS ? content.slice(0, MAX_MESSAGE_CHARS) + '…' : content;
      return { role, content: trimmed } as ChatMessage;
    })
    .filter(Boolean) as ChatMessage[];

  // Keep only the most recent messages
  return cleaned.slice(-MAX_HISTORY_MESSAGES);
}

function safeStringifyAndTruncate(value: unknown, maxChars: number): string {
  let text = '';
  try {
    text = JSON.stringify(value);
  } catch {
    text = JSON.stringify({ error: 'Unserializable tool result' });
  }

  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '…';
}

function getErrorStatus(err: unknown): number | null {
  if (typeof err === 'object' && err && 'status' in err) {
    const status = (err as any).status;
    if (typeof status === 'number') return status;
  }
  return null;
}

function extractRetryAfterSeconds(err: unknown): number | null {
  // Try common shapes from GoogleGenerativeAIError
  const anyErr = err as any;
  const details = anyErr?.errorDetails;
  if (Array.isArray(details)) {
    const retryInfo = details.find((d) => d?.['@type']?.includes('RetryInfo') && typeof d?.retryDelay === 'string');
    const delay = retryInfo?.retryDelay as string | undefined;
    const match = delay?.match(/^(\d+)s$/);
    if (match) return Number(match[1]);
  }

  const message = typeof anyErr?.message === 'string' ? anyErr.message : '';
  const msgMatch = message.match(/retryDelay"\s*:\s*"(\d+)s"/i);
  if (msgMatch) return Number(msgMatch[1]);

  const match = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (match) return Math.ceil(Number(match[1]));

  return null;
}

// Initialize AI clients
const genAI = process.env.GOOGLE_AI_KEY 
  ? new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY)
  : null;

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const GEMINI_MODEL_CACHE_TTL_MS = 30 * 60 * 1000;
let geminiModelCache:
  | { model: string; apiVersion: 'v1' | 'v1beta'; fetchedAt: number }
  | null = null;

const GROQ_MODEL_CACHE_TTL_MS = 30 * 60 * 1000;
let groqModelCache:
  | { model: string; fetchedAt: number }
  | null = null;

async function listGeminiModels(apiKey: string, apiVersion: 'v1' | 'v1beta'): Promise<GeminiModelListItem[]> {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`ListModels failed (${apiVersion}): ${res.status} ${res.statusText} ${text}`);
    (err as any).status = res.status;
    throw err;
  }

  const data = (await res.json().catch(() => ({}))) as GeminiModelListResponse;
  return Array.isArray(data.models) ? data.models : [];
}

function pickPreferredGeminiModel(models: GeminiModelListItem[]): string | null {
  const supported = models
    .map((m) => (typeof m.name === 'string' ? m.name : ''))
    .filter(Boolean)
    .filter((name) => name.startsWith('models/'));

  const shortNames = supported.map((name) => name.replace(/^models\//, ''));

  const preferences: RegExp[] = [
    /^gemini-2\.0-flash$/i,
    /^gemini-2\.0-flash-?lite$/i,
    /^gemini-2\.0-flash/i,
    /^gemini-1\.5-flash/i,
    /^gemini-1\.5-pro/i,
    /^gemini/i,
  ];

  for (const pref of preferences) {
    const found = shortNames.find((n) => pref.test(n));
    if (found) return found;
  }

  return shortNames[0] ?? null;
}

async function resolveGeminiModelName(): Promise<{ model: string; apiVersion: 'v1' | 'v1beta' }> {
  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) throw new Error('Gemini not configured');

  if (geminiModelCache && Date.now() - geminiModelCache.fetchedAt < GEMINI_MODEL_CACHE_TTL_MS) {
    return { model: geminiModelCache.model, apiVersion: geminiModelCache.apiVersion };
  }

  const versions: Array<'v1' | 'v1beta'> = ['v1', 'v1beta'];
  let lastError: unknown = null;

  for (const apiVersion of versions) {
    try {
      const models = await listGeminiModels(apiKey, apiVersion);
      const picked = pickPreferredGeminiModel(models);
      if (!picked) continue;

      geminiModelCache = { model: picked, apiVersion, fetchedAt: Date.now() };
      console.log(`[AI] Gemini model auto-selected: ${picked} (${apiVersion})`);
      return { model: picked, apiVersion };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to resolve Gemini model');
}

async function resolveGroqChatModelName(): Promise<string> {
  if (!groq) throw new Error('Groq not configured');

  if (groqModelCache && Date.now() - groqModelCache.fetchedAt < GROQ_MODEL_CACHE_TTL_MS) {
    return groqModelCache.model;
  }

  const list = await groq.models.list();
  const ids = Array.isArray((list as any)?.data)
    ? ((list as any).data as Array<{ id: string }>).map((m) => m.id).filter(Boolean)
    : [];

  // Prefer models known to be chat-capable and typically tool-capable.
  // Keep this flexible because Groq decommissions/renames models.
  const preferences: RegExp[] = [
    /^gpt-oss-20b$/i,
    /^llama-3\.[0-9]+-70b/i,
    /^llama-3\.[0-9]+-8b/i,
    /^llama-3\.[0-9]+/i,
    /^mixtral/i,
    /^gemma/i,
  ];

  for (const pref of preferences) {
    const found = ids.find((id) => pref.test(id));
    if (found) {
      groqModelCache = { model: found, fetchedAt: Date.now() };
      console.log(`[AI] Groq model auto-selected: ${found}`);
      return found;
    }
  }

  const fallback = ids[0];
  if (!fallback) throw new Error('No Groq models available');
  groqModelCache = { model: fallback, fetchedAt: Date.now() };
  console.log(`[AI] Groq model auto-selected (fallback): ${fallback}`);
  return fallback;
}

function isGroqModelInvalidError(err: unknown): boolean {
  const anyErr = err as any;
  const status = getErrorStatus(anyErr);
  const msg = typeof anyErr?.message === 'string' ? anyErr.message : '';
  const bodyMsg = typeof anyErr?.error?.message === 'string' ? anyErr.error.message : '';
  return (
    status === 400 &&
    (msg.includes('model') || bodyMsg.includes('model')) &&
    (msg.includes('decommissioned') || bodyMsg.includes('decommissioned') || msg.includes('no longer supported') || bodyMsg.includes('no longer supported'))
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    
    // Only ADMIN and RESOURCE roles can use AI chat
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { message, conversationHistory = [] } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Check if any AI provider is configured
    if (!genAI && !groq && !openai) {
      return NextResponse.json({ 
        error: 'AI not configured. Please set OPENAI_API_KEY or GROQ_API_KEY (or GOOGLE_AI_KEY) in your environment variables. See AI_SETUP_GUIDE.md for instructions.',
        setup_required: true
      }, { status: 503 });
    }

    const normalizedHistory = normalizeConversationHistory(conversationHistory);

    // Preferred: OpenAI (most reliable). Then Gemini (if quota allows). Then Groq.
    if (openai) {
      try {
        const response = await processWithOpenAI(message, normalizedHistory, user.id);
        return NextResponse.json({
          message: response,
          provider: 'openai'
        });
      } catch (error: any) {
        console.error('OpenAI error:', error);

        // fallback chain
        if (genAI) {
          try {
            const response = await processWithGemini(message, normalizedHistory, user.id);
            return NextResponse.json({ message: response, provider: 'gemini' });
          } catch (gemErr) {
            console.error('Gemini error (after OpenAI):', gemErr);
          }
        }

        if (groq) {
          try {
            const response = await processWithGroq(message, normalizedHistory, user.id);
            return NextResponse.json({ message: response, provider: 'groq' });
          } catch (groqErr) {
            console.error('Groq error (after OpenAI):', groqErr);
          }
        }

        const status = getErrorStatus(error) ?? 500;
        return NextResponse.json(
          { error: 'OpenAI failed to process the request.' },
          { status: status >= 400 && status < 600 ? status : 500 }
        );
      }
    }

    // Try Gemini first (free tier)
    if (genAI) {
      try {
        const response = await processWithGemini(message, normalizedHistory, user.id);
        return NextResponse.json({ 
          message: response,
          provider: 'gemini'
        });
      } catch (error: any) {
        console.error('Gemini error:', error);

        // If Groq is available, fallback for better uptime
        if (groq) {
          console.log('Falling back to Groq after Gemini error');
          try {
            const response = await processWithGroq(message, normalizedHistory, user.id);
            return NextResponse.json({
              message: response,
              provider: 'groq'
            });
          } catch (groqErr) {
            console.error('Groq error:', groqErr);
            return NextResponse.json(
              {
                error:
                  'Both Gemini and Groq failed. Groq may have a decommissioned model configured or the API key may be invalid.',
              },
              { status: 502 }
            );
          }
        }

        // No fallback available: return a useful status/message instead of generic 500
        const status = getErrorStatus(error) ?? 500;
        const retryAfterSeconds = extractRetryAfterSeconds(error);

        // Common case: Gemini quota/rate-limits (429)
        if (status === 429) {
          return NextResponse.json(
            {
              error:
                'Gemini quota/rate limit exceeded for the current API key/project. Add GROQ_API_KEY for fallback, or enable Gemini API billing/quota for this key.',
              provider: 'gemini',
              retryAfterSeconds,
            },
            {
              status: 429,
              headers: retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : undefined,
            }
          );
        }

        return NextResponse.json(
          {
            error: 'Gemini failed to process the request.',
            provider: 'gemini',
          },
          { status: status >= 400 && status < 600 ? status : 500 }
        );
      }
    } 
    // If Gemini not configured, try Groq
    else if (groq) {
      const response = await processWithGroq(message, normalizedHistory, user.id);
      return NextResponse.json({ 
        message: response,
        provider: 'groq'
      });
    }
    
    return NextResponse.json({ 
      error: 'No AI provider configured. Please set OPENAI_API_KEY or GROQ_API_KEY or GOOGLE_AI_KEY' 
    }, { status: 500 });

  } catch (error) {
    console.error('AI chat error:', error);

    const status = getErrorStatus(error) ?? 500;
    const retryAfterSeconds = extractRetryAfterSeconds(error);
    if (status === 429) {
      return NextResponse.json(
        {
          error: 'AI provider rate limit/quota exceeded. Please retry shortly.',
          retryAfterSeconds,
        },
        {
          status: 429,
          headers: retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : undefined,
        }
      );
    }

    return NextResponse.json({ 
      error: 'Failed to process message' 
    }, { status: 500 });
  }
}

async function processWithOpenAI(message: string, history: ChatMessage[], userId: string): Promise<string> {
  if (!openai) throw new Error('OpenAI not configured');

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const messages: Array<any> = [
    {
      role: 'system',
      content: `You are an AI Resource Manager for a VFX production studio. You help manage resource allocations, schedules, and forecasts.

Important guidelines:
- You can only VIEW data, not modify it
- Use tools to fetch real data when needed
- Format dates as YYYY-MM-DD
- Be concise and professional

Current date: ${new Date().toISOString().split('T')[0]}`,
    },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  const tools = aiFunctionDeclarations.map((fn) => ({
    type: 'function',
    function: {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters as any,
    },
  }));

  for (let step = 0; step < 6; step++) {
    const completion = await openai.chat.completions.create({
      model,
      messages,
      tools: tools as any,
      tool_choice: 'auto' as any,
      temperature: 0.2,
      max_tokens: 800,
    } as any);

    const msg = completion.choices?.[0]?.message as any;
    if (!msg) return 'No response generated';

    const toolCalls = msg.tool_calls as any[] | undefined;
    if (!toolCalls || toolCalls.length === 0) {
      return msg.content || 'No response generated';
    }

    messages.push({
      role: 'assistant',
      content: msg.content ?? '',
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const toolCallId = call.id;
      const functionName = call.function?.name;
      const rawArgs = call.function?.arguments;

      let args: any = {};
      try {
        args = rawArgs ? JSON.parse(rawArgs) : {};
      } catch {
        args = {};
      }

      const result = await executeAIFunction(functionName, args, userId);
      messages.push({
        role: 'tool',
        tool_call_id: toolCallId,
        content: safeStringifyAndTruncate(result ?? { error: 'No response' }, MAX_TOOL_RESULT_CHARS),
      });
    }
  }

  return 'I gathered the requested data but could not finalize the response. Please try again with a narrower date range.';
}

async function processWithGemini(message: string, history: ChatMessage[], userId: string): Promise<string> {
  if (!genAI) throw new Error('Gemini not configured');

  const { model: resolvedModel } = await resolveGeminiModelName();

  const model = genAI.getGenerativeModel({ 
    model: resolvedModel,
    tools: [{ functionDeclarations: aiFunctionDeclarations }],
    systemInstruction: `You are an AI Resource Manager for a VFX production studio. You help manage resource allocations, schedules, and forecasts.

Current capabilities:
- View resource forecasts and allocations
- Check employee availability and schedules
- Analyze department utilization
- Find overallocated resources
- Get show and shot information

Important guidelines:
- Always use the provided functions to get real data
- Format dates as YYYY-MM-DD
- Be concise and professional
- When showing data, use clear formatting with bullet points or tables
- If you need more specific information, ask the user
- You can only VIEW data, not modify it

Current date: ${new Date().toISOString().split('T')[0]}

If a user asks for “today/this week/this month”, ask for an explicit date range before calling functions.`
  });

  // Convert history to Gemini format, but skip if it starts with assistant message
  let geminiHistory: any[] = [];
  
  // Only use history if it starts with a user message
  if (history.length > 0 && history[0].role === 'user') {
    geminiHistory = history.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  }

  const chat = model.startChat({ history: geminiHistory });

  // First turn: user message
  let result = await chat.sendMessage(message);

  // Function-calling loop (read-only). Cap to prevent infinite cycles.
  for (let step = 0; step < 6; step++) {
    const calls = result.response.functionCalls?.();
    if (!calls || calls.length === 0) {
      break;
    }

    const functionResponseParts = [] as Array<{ functionResponse: { name: string; response: object } }>;

    for (const call of calls) {
      const functionName = call.name;
      const args = call.args ?? {};
      const response = await executeAIFunction(functionName, args, userId);
      functionResponseParts.push({
        functionResponse: {
          name: functionName,
          response: response ?? { error: 'No response' },
        },
      });
    }

    // Send all function responses in one function-role message
    result = await chat.sendMessage(functionResponseParts);
  }

  return result.response.text();
}

async function processWithGroq(message: string, history: ChatMessage[], userId: string): Promise<string> {
  if (!groq) throw new Error('Groq not configured');

  // Groq uses an OpenAI-compatible API and supports tool calling on many models.
  // We'll enable tool calling so fallback can still answer with live DB data.
  const messages: Array<any> = [
    {
      role: 'system' as const,
      content: `You are an AI Resource Manager for a VFX production studio. You help manage resource allocations, schedules, and forecasts.

Important guidelines:
- You can only VIEW data, not modify it
- Use tools to fetch real data when needed
- Format dates as YYYY-MM-DD
- Be concise and professional

Current date: ${new Date().toISOString().split('T')[0]}`
    },
    ...history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    {
      role: 'user' as const,
      content: message
    }
  ];

  const tools = aiFunctionDeclarations.map((fn) => ({
    type: 'function',
    function: {
      name: fn.name,
      description: fn.description,
      // SchemaType enums serialize to strings ('object', 'string', ...), which is valid JSON Schema
      parameters: fn.parameters as any,
    },
  }));

  const preferred = await resolveGroqChatModelName();
  const modelCandidates = [
    preferred,
    // A few reasonable fallbacks in case the preferred model is decommissioned.
    'gpt-oss-20b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
  ].filter((v, idx, arr) => Boolean(v) && arr.indexOf(v) === idx);

  // Tool-calling loop
  let selectedModel = modelCandidates[0];
  for (let step = 0; step < 6; step++) {
    let completion: any;

    // Try candidates (handles decommissioned model errors gracefully)
    let lastErr: unknown = null;
    for (const candidate of modelCandidates) {
      try {
        selectedModel = candidate;
        completion = await groq.chat.completions.create({
          messages,
          model: candidate,
          temperature: 0.2,
          max_tokens: 1024,
          tools: tools as any,
          tool_choice: 'auto' as any,
        } as any);
        break;
      } catch (err) {
        lastErr = err;
        if (isGroqModelInvalidError(err)) {
          // bust cache so the next request re-lists
          groqModelCache = null;
          continue;
        }
        throw err;
      }
    }
    if (!completion) {
      throw lastErr instanceof Error ? lastErr : new Error('Groq request failed');
    }

    const msg = completion.choices?.[0]?.message as any;
    if (!msg) return 'No response generated';

    const toolCalls = msg.tool_calls as any[] | undefined;
    if (!toolCalls || toolCalls.length === 0) {
      return msg.content || 'No response generated';
    }

    messages.push({
      role: 'assistant',
      content: msg.content ?? '',
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const toolCallId = call.id;
      const functionName = call.function?.name;
      const rawArgs = call.function?.arguments;

      let args: any = {};
      try {
        args = rawArgs ? JSON.parse(rawArgs) : {};
      } catch {
        args = {};
      }

      const result = await executeAIFunction(functionName, args, userId);
      messages.push({
        role: 'tool',
        tool_call_id: toolCallId,
        content: safeStringifyAndTruncate(result ?? { error: 'No response' }, MAX_TOOL_RESULT_CHARS),
      });
    }
  }

  // If the model keeps calling tools, return a safe fallback.
  return `I gathered the requested data using ${selectedModel}, but could not finalize the response. Please try again with a narrower date range.`;
}
