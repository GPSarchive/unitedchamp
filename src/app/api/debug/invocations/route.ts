// /api/debug/invocations/route.ts
// Temporary debug endpoint to track function invocations
import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET() {
  try {
    // Get some sample rate limit keys to see activity
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / 60); // Current minute bucket

    // Sample some potential keys (this is just diagnostic)
    const stats = {
      timestamp: new Date().toISOString(),
      message: "Check Vercel Dashboard → Functions → Invocations for detailed logs",
      tips: [
        "Look at 'Top Paths' in Vercel Analytics",
        "Check for /api/* routes being called repeatedly",
        "Check for /_next/image/* requests (image optimization)",
        "Look for unusual user agents in logs",
        "robots.txt has been added to block aggressive crawlers"
      ],
      current_bucket: bucket,
      note: "Rate limiting uses KV, which counts as function invocations"
    };

    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to get stats' },
      { status: 500 }
    );
  }
}
