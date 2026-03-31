// src/app/check-email/page.tsx
import { cookies } from 'next/headers';
import CheckEmailContent from './CheckEmailContent';

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; email?: string }>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  // Prefer cookie over URL param; fall back to URL param for backwards compat
  const email = jar.get('__pending_email')?.value || params.email || '';
  const message = params.msg || '';

  return <CheckEmailContent email={email} message={message} />;
}
