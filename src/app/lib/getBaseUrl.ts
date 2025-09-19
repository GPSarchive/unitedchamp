// app/lib/getBaseUrl.ts
export function getBaseUrl(req?: Request) {
    const env = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    if (env) return env;
    try {
      return req ? new URL(req.url).origin : 'http://localhost:3000';
    } catch {
      return 'http://localhost:3000';
    }
  }
  