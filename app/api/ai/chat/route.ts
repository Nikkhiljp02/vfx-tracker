import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@/lib/auth';
import { aiFunctionDeclarations, executeAIFunction } from '@/lib/ai/functions';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type PendingAction = {
  tool: string;
  args: unknown;
  summary: string;
};

type AIChatResult = {
  text: string;
  pendingActions?: PendingAction[];
};

const WRITE_TOOL_NAMES = new Set<string>([
  'assign_resource_allocation',
  'assign_employee_to_shot_for_workdays',
  'remove_employee_allocations',
  'remove_shot_allocations',
  'remove_all_allocations',
  'remove_show_allocations',
  'set_weekend_working_policy',
]);

function formatPendingActionSummary(tool: string, args: any): string {
  if (tool === 'assign_resource_allocation') {
    const employeeId = typeof args?.employeeId === 'string' ? args.employeeId : '';
    const date = typeof args?.date === 'string' ? args.date : '';
    const showName = typeof args?.showName === 'string' ? args.showName : '';
    const shotName = typeof args?.shotName === 'string' ? args.shotName : '';
    const manDays = args?.manDays;
    const flags = [args?.isLeave ? 'leave' : null, args?.isIdle ? 'idle' : null, args?.isWeekendWorking ? 'weekend' : null]
      .filter(Boolean)
      .join(', ');

    const target = showName || shotName ? `${showName}${showName && shotName ? ' / ' : ''}${shotName}` : '(leave/idle)';
    return `Assign ${employeeId} on ${date}: ${target} for ${manDays} MD${flags ? ` (${flags})` : ''}`;
  }

  if (tool === 'assign_employee_to_shot_for_workdays') {
    const employeeId = typeof args?.employeeId === 'string' ? args.employeeId : '';
    const startDate = typeof args?.startDate === 'string' ? args.startDate : '';
    const workDays = args?.workDays;
    const showName = typeof args?.showName === 'string' ? args.showName : '';
    const shotName = typeof args?.shotName === 'string' ? args.shotName : '';
    const excludeDates = Array.isArray(args?.excludeDates) ? args.excludeDates : [];
    const excludeText = excludeDates.length ? ` excluding ${excludeDates.join(', ')}` : '';
    const md = args?.manDays ?? 1;
    return `Assign ${employeeId} to ${showName} / ${shotName} for ${workDays} working days from ${startDate}${excludeText} (${md} MD/day; weekends skipped unless marked working)`;
  }

  if (tool === 'remove_employee_allocations') {
    const employeeId = typeof args?.employeeId === 'string' ? args.employeeId : '';
    const startDate = typeof args?.startDate === 'string' ? args.startDate : 'today';
    const endDate = typeof args?.endDate === 'string' ? args.endDate : 'today+365';
    const showName = typeof args?.showName === 'string' ? args.showName : '';
    const shotName = typeof args?.shotName === 'string' ? args.shotName : '';
    const filters = [showName ? `show=${showName}` : null, shotName ? `shot=${shotName}` : null].filter(Boolean).join(', ');
    return `Remove allocations for ${employeeId} from ${startDate} to ${endDate}${filters ? ` (${filters})` : ''}`;
  }

  if (tool === 'remove_shot_allocations') {
    const shotName = typeof args?.shotName === 'string' ? args.shotName : '';
    const showName = typeof args?.showName === 'string' ? args.showName : '';
    const startDate = typeof args?.startDate === 'string' ? args.startDate : '';
    const endDate = typeof args?.endDate === 'string' ? args.endDate : '';
    const range = startDate || endDate ? ` from ${startDate || 'today'} to ${endDate || 'today+365'}` : ' (all dates)';
    return `Remove allocations for shot ${shotName}${showName ? ` (show=${showName})` : ''}${range}`;
  }

  if (tool === 'remove_show_allocations') {
    const showName = typeof args?.showName === 'string' ? args.showName : '';
    const startDate = typeof args?.startDate === 'string' ? args.startDate : '';
    const endDate = typeof args?.endDate === 'string' ? args.endDate : '';
    const range = startDate || endDate ? ` from ${startDate || 'today'} to ${endDate || 'today+365'}` : ' (all dates)';
    return `Remove allocations for ALL shots in show ${showName}${range}`;
  }

  if (tool === 'remove_all_allocations') {
    const startDate = typeof args?.startDate === 'string' ? args.startDate : '';
    const endDate = typeof args?.endDate === 'string' ? args.endDate : '';
    const range = startDate || endDate ? ` from ${startDate || 'today'} to ${endDate || 'today+365'}` : ' (all dates)';
    return `Remove ALL allocations for ALL employees${range}`;
  }

  if (tool === 'set_weekend_working_policy') {
    const sat = typeof args?.saturdayWorking === 'boolean' ? (args.saturdayWorking ? 'ON' : 'OFF') : 'unchanged';
    const sun = typeof args?.sundayWorking === 'boolean' ? (args.sundayWorking ? 'ON' : 'OFF') : 'unchanged';
    return `Set weekend working policy (Saturday=${sat}, Sunday=${sun})`;
  }

  return `${tool}`;
}

function normalizeWriteToolCall(tool: string, args: any): { tool: string; args: any } {
  // Heuristic guardrails to avoid proposing invalid write actions.
  // Most common mistake: using remove_employee_allocations for a shot-wide removal.

  if (tool === 'remove_employee_allocations') {
    const employeeId = typeof args?.employeeId === 'string' ? args.employeeId.trim() : '';
    const shotName = typeof args?.shotName === 'string' ? args.shotName.trim() : '';
    const showName = typeof args?.showName === 'string' ? args.showName.trim() : '';

    // No employeeId means the user likely wants a broader delete.
    // Prefer: shot-wide delete if we have a shot hint; else show-wide delete if we have a show hint; else global.
    if (!employeeId) {
      if (shotName) {
        return {
          tool: 'remove_shot_allocations',
          args: {
            shotName,
            showName: showName || undefined,
            startDate: args?.startDate,
            endDate: args?.endDate,
          },
        };
      }

      if (showName) {
        return {
          tool: 'remove_show_allocations',
          args: {
            showName,
            startDate: args?.startDate,
            endDate: args?.endDate,
          },
        };
      }

      return {
        tool: 'remove_all_allocations',
        args: {
          startDate: args?.startDate,
          endDate: args?.endDate,
        },
      };
    }
  }

  if (tool === 'remove_shot_allocations') {
    const shotName = typeof args?.shotName === 'string' ? args.shotName.trim() : '';
    const showName = typeof args?.showName === 'string' ? args.showName.trim() : '';
    if (!shotName && showName) {
      return {
        tool: 'remove_shot_allocations',
        args: {
          shotName: showName,
          showName: undefined,
          startDate: args?.startDate,
          endDate: args?.endDate,
        },
      };
    }
  }

  return { tool, args };
}

const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 2500;
const MAX_TOOL_RESULT_CHARS = 3000;

// In-process cooldown when OpenAI returns 429. This helps avoid stampeding the provider
// when multiple users are chatting simultaneously.
let openaiRateLimitedUntilMs = 0;

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
  const anyErr = err as any;

  const headers = anyErr?.headers;
  try {
    const getHeader = (name: string): string | null => {
      if (!headers) return null;
      if (typeof headers?.get === 'function') {
        return headers.get(name);
      }
      if (typeof headers === 'object' && headers) {
        const v = (headers as any)[name] ?? (headers as any)[name.toLowerCase()];
        return typeof v === 'string' ? v : null;
      }
      return null;
    };

    const retryAfterMs = getHeader('retry-after-ms');
    if (retryAfterMs && !Number.isNaN(Number(retryAfterMs))) {
      return Math.ceil(Number(retryAfterMs) / 1000);
    }

    const retryAfter = getHeader('retry-after');
    if (retryAfter && !Number.isNaN(Number(retryAfter))) {
      return Math.ceil(Number(retryAfter));
    }
  } catch {
    // Ignore header parsing errors
  }

  const message = typeof anyErr?.message === 'string' ? anyErr.message : '';

  // Common OpenAI error patterns
  // - "Please try again in 4h18m46.08s"
  // - "Please try again in 12m3.2s"
  // - "Please try again in 10s"
  const hms = message.match(/try again in\s+(\d+)h(\d+)m(\d+(?:\.\d+)?)s/i);
  if (hms) {
    const h = Number(hms[1]);
    const m = Number(hms[2]);
    const s = Number(hms[3]);
    return Math.ceil(h * 3600 + m * 60 + s);
  }

  const ms = message.match(/try again in\s+(\d+)m(\d+(?:\.\d+)?)s/i);
  if (ms) {
    const m = Number(ms[1]);
    const s = Number(ms[2]);
    return Math.ceil(m * 60 + s);
  }

  const sOnly = message.match(/try again in\s+(\d+(?:\.\d+)?)s/i);
  if (sOnly) return Math.ceil(Number(sOnly[1]));

  const retryIn = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (retryIn) return Math.ceil(Number(retryIn[1]));

  return null;
}

// Initialize AI clients
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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

    // OpenAI-only
    if (!openai) {
      return NextResponse.json(
        {
          error: 'AI not configured. Please set OPENAI_API_KEY in your environment variables. See AI_SETUP_GUIDE.md for instructions.',
          setup_required: true,
        },
        { status: 503 }
      );
    }

    if (openaiRateLimitedUntilMs > Date.now()) {
      const retryAfterSeconds = Math.ceil((openaiRateLimitedUntilMs - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: 'AI provider rate limit/quota exceeded. Please retry later.',
          retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        }
      );
    }

    const normalizedHistory = normalizeConversationHistory(conversationHistory);

    try {
      const response = await processWithOpenAI(message, normalizedHistory, user.id);
      return NextResponse.json({
        message: response.text,
        provider: 'openai',
        pendingActions: response.pendingActions,
      });
    } catch (error: any) {
      console.error('OpenAI error:', error);
      const status = getErrorStatus(error) ?? 500;

      if (status === 429) {
        const retryAfterSeconds = extractRetryAfterSeconds(error);
        if (retryAfterSeconds && retryAfterSeconds > 0) {
          openaiRateLimitedUntilMs = Date.now() + retryAfterSeconds * 1000;
        } else {
          // Default small cooldown when provider doesn't supply timing.
          openaiRateLimitedUntilMs = Date.now() + 60_000;
        }

        return NextResponse.json(
          {
            error: 'AI provider rate limit/quota exceeded. Please retry later.',
            retryAfterSeconds: retryAfterSeconds ?? undefined,
          },
          {
            status: 429,
            headers: retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : undefined,
          }
        );
      }

      return NextResponse.json(
        { error: 'OpenAI failed to process the request.' },
        { status: status >= 400 && status < 600 ? status : 500 }
      );
    }

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

async function processWithOpenAI(message: string, history: ChatMessage[], userId: string): Promise<AIChatResult> {
  if (!openai) throw new Error('OpenAI not configured');

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const messages: Array<any> = [
    {
      role: 'system',
      content: `You are an AI Resource Manager for a VFX studio.

Rules:
- Use tools to fetch data when needed.
- NEVER execute write actions without explicit user approval.
- If proposing changes, respond with the exact action(s) and ask for approval.
- Prefer deletion tools for removals (do not set man-days to 0).
- Dates must be YYYY-MM-DD.

Interpretation hints:
- "all allocations for employee X" without dates => next 60 days.
- "overall"/"all future" => today..today+365 unless specified.

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

  for (let step = 0; step < 4; step++) {
    const completion = await openai.chat.completions.create({
      model,
      messages,
      tools: tools as any,
      tool_choice: 'auto' as any,
      temperature: 0.2,
      max_tokens: 500,
    } as any);

    const msg = completion.choices?.[0]?.message as any;
    if (!msg) return { text: 'No response generated' };

    const toolCalls = msg.tool_calls as any[] | undefined;
    if (!toolCalls || toolCalls.length === 0) {
      return { text: msg.content || 'No response generated' };
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

      if (typeof functionName === 'string' && WRITE_TOOL_NAMES.has(functionName)) {
        const pendingActions: PendingAction[] = toolCalls
          .map((c) => {
            const fn = c.function?.name;
            if (typeof fn !== 'string' || !WRITE_TOOL_NAMES.has(fn)) return null;
            let parsed: any = {};
            try {
              parsed = c.function?.arguments ? JSON.parse(c.function.arguments) : {};
            } catch {
              parsed = {};
            }

            const normalized = normalizeWriteToolCall(fn, parsed);
            if (!WRITE_TOOL_NAMES.has(normalized.tool)) return null;

            return {
              tool: normalized.tool,
              args: normalized.args,
              summary: formatPendingActionSummary(normalized.tool, normalized.args),
            };
          })
          .filter(Boolean) as PendingAction[];

        const text =
          (msg.content?.trim() ? msg.content.trim() + '\n\n' : '') +
          `I can do that. Please review and approve the following action(s):\n` +
          pendingActions.map((a) => `- ${a.summary}`).join('\n');

        return { text, pendingActions };
      }

      const result = await executeAIFunction(functionName, args, userId);
      messages.push({
        role: 'tool',
        tool_call_id: toolCallId,
        content: safeStringifyAndTruncate(result ?? { error: 'No response' }, MAX_TOOL_RESULT_CHARS),
      });
    }
  }

  return { text: 'I gathered the requested data but could not finalize the response. Please try again with a narrower date range.' };
}
