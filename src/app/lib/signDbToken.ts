// app/lib/signDbToken.ts
import jwt from 'jsonwebtoken';

export function signDbToken(opts: { table: string; userId?: string; ttlSec?: number }) {
  const { table, userId, ttlSec = 60 } = opts;
  const secret = process.env.SUPABASE_JWT_SECRET!;
  if (!secret) throw new Error('SUPABASE_JWT_SECRET missing');

  return jwt.sign(
    {
      allowed: 'true',      // custom claim your RLS will check
      table,                // scope to a table
      ...(userId ? { user_id: userId } : {}),
      exp: Math.floor(Date.now() / 1000) + ttlSec,
    },
    secret,
    { algorithm: 'HS256' }
  );
}
