// app/lib/signDbToken.ts
import jwt from 'jsonwebtoken';

export function signDbToken(opts: { table: string; userId?: string; ttlSec?: number }) {
  const { table, userId, ttlSec = 60 } = opts;
  const secret = process.env.SUPABASE_JWT_SECRET!; // your new ECC private key
  const kid    = process.env.SUPABASE_JWT_KID!;    // your new ECC key ID

  return jwt.sign(
    {
      allowed: 'true',
      table,
      ...(userId ? { user_id: userId } : {}),
      exp: Math.floor(Date.now() / 1000) + ttlSec,
    },
    secret,
    {
      algorithm: 'ES256',   
      keyid: kid,
    }
  );
}
