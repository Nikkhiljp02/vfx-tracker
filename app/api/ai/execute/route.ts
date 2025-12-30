import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { executeAIFunction } from '@/lib/ai/functions';

type PendingAction = {
  tool: string;
  args: unknown;
};

const WRITE_TOOL_NAMES = new Set<string>([
  'assign_resource_allocation',
  'assign_employee_to_shot_for_workdays',
  'remove_employee_allocations',
  'remove_shot_allocations',
]);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const actions = Array.isArray(body?.actions) ? (body.actions as PendingAction[]) : [];

    if (actions.length === 0) {
      return NextResponse.json({ error: 'actions[] is required' }, { status: 400 });
    }

    for (const action of actions) {
      if (!action?.tool || typeof action.tool !== 'string') {
        return NextResponse.json({ error: 'Each action must include tool' }, { status: 400 });
      }
      if (!WRITE_TOOL_NAMES.has(action.tool)) {
        return NextResponse.json({ error: `Tool not allowed: ${action.tool}` }, { status: 400 });
      }
    }

    const results: unknown[] = [];
    for (const action of actions) {
      const result = await executeAIFunction(action.tool, action.args ?? {}, user.id);
      results.push({ tool: action.tool, result });
    }

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (error) {
    console.error('AI execute error:', error);
    return NextResponse.json({ error: 'Failed to execute actions' }, { status: 500 });
  }
}
