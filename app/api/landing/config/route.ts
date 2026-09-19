import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { createSupabaseAuthServerClient } from '../../../../lib/supabase/auth-server';
import { getAuthUserAndProfile } from '../../roles/role-utils';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'landing-config.json');

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Failed reading landing config:', err);
  }
  return null;
}

function writeConfig(data: Record<string, unknown>) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export async function GET() {
  const config = readConfig();
  return NextResponse.json(
    { success: true, config },
    {
      headers: {
        'CDN-Cache-Control': 'public, s-maxage=120, stale-while-revalidate=1200',
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=1200',
        'Vary': 'Accept-Encoding'
      }
    }
  );
}

export async function PUT(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { profile } = await getAuthUserAndProfile(serverClient, request);

    const isOwner = profile.role === 'OWNER';
    const perms = Array.isArray(profile.permissions) ? profile.permissions : [];
    const hasLandingPerm = perms.includes('*') || perms.includes('master_landing.*') || perms.includes('landing.*');

    if (!isOwner && !hasLandingPerm) {
      return NextResponse.json(
        { success: false, message: 'Forbidden: Only OWNER and master landing administrators may edit this content.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    writeConfig(body);
    return NextResponse.json({ success: true, config: body });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update master landing configuration.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
