import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const SETTINGS_KEY = 'workingWeekends';

function parseWeekends(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v));
  } catch {
    return [];
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as any;
  if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const settings = await prisma.systemSettings.findFirst({ where: { key: SETTINGS_KEY } });
  const weekends = parseWeekends(settings?.value);
  return NextResponse.json({ weekends });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as any;
  if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const weekends = Array.isArray(body?.weekends) ? (body.weekends as unknown[]) : [];

  const sanitized = weekends
    .filter((v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))
    .slice(0, 5000);

  await prisma.systemSettings.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: JSON.stringify(sanitized) },
    update: { value: JSON.stringify(sanitized) },
  });

  return NextResponse.json({ ok: true, weekends: sanitized });
}
