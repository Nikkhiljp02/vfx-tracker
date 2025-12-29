import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { auth } from '@/lib/auth';
import { aiFunctionDeclarations, executeAIFunction } from '@/lib/ai/functions';

type GeminiModelListItem = {
  name?: string;
  supportedGenerationMethods?: string[];
};

type GeminiModelListResponse = {
  models?: GeminiModelListItem[];
};

// Initialize AI clients
const genAI = process.env.GOOGLE_AI_KEY 
  ? new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY)
  : null;

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const GEMINI_MODEL_CACHE_TTL_MS = 30 * 60 * 1000;
let geminiModelCache:
  | { model: string; apiVersion: 'v1' | 'v1beta'; fetchedAt: number }
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
    if (!genAI && !groq) {
      return NextResponse.json({ 
        error: 'AI not configured. Please set GOOGLE_AI_KEY or GROQ_API_KEY in your environment variables. See AI_SETUP_GUIDE.md for instructions.',
        setup_required: true
      }, { status: 503 });
    }

    // Try Gemini first (free tier)
    if (genAI) {
      try {
        const response = await processWithGemini(message, conversationHistory, user.id);
        return NextResponse.json({ 
          message: response,
          provider: 'gemini'
        });
      } catch (error: any) {
        console.error('Gemini error:', error);

        // If Groq is available, fallback for better uptime
        if (groq) {
          console.log('Falling back to Groq after Gemini error');
          const response = await processWithGroq(message, conversationHistory, user.id);
          return NextResponse.json({
            message: response,
            provider: 'groq'
          });
        }

        throw error;
      }
    } 
    // If Gemini not configured, try Groq
    else if (groq) {
      const response = await processWithGroq(message, conversationHistory, user.id);
      return NextResponse.json({ 
        message: response,
        provider: 'groq'
      });
    }
    
    return NextResponse.json({ 
      error: 'No AI provider configured. Please set GOOGLE_AI_KEY or GROQ_API_KEY' 
    }, { status: 500 });

  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json({ 
      error: 'Failed to process message' 
    }, { status: 500 });
  }
}

async function processWithGemini(message: string, history: any[], userId: string): Promise<string> {
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
    geminiHistory = history.map((msg: any) => ({
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

async function processWithGroq(message: string, history: any[], userId: string): Promise<string> {
  if (!groq) throw new Error('Groq not configured');

  // Groq uses OpenAI-compatible API but with limited function calling
  // For now, use it for simple queries without function calling
  const messages = [
    {
      role: 'system' as const,
      content: `You are an AI Resource Manager for a VFX production studio. You help with resource planning and scheduling queries. 

Note: You are currently running in fallback mode with limited capabilities. You can answer general questions about resource management but cannot access live data. Inform the user that live data access is temporarily unavailable and they should try again shortly.

Current date: ${new Date().toISOString().split('T')[0]}`
    },
    ...history.map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    {
      role: 'user' as const,
      content: message
    }
  ];

  const completion = await groq.chat.completions.create({
    messages,
    model: "llama-3.1-70b-versatile",
    temperature: 0.7,
    max_tokens: 1024
  });

  return completion.choices[0]?.message?.content || 'No response generated';
}
