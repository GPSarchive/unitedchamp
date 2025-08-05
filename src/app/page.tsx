import Image from 'next/image';
import { signDbToken } from '@/app/lib/signDbToken';
import { Carousel } from '@/app/components/HomePageComponents/Carousel';

type User = { id: number; name: string };

const imageUrls = ['/pexels-omar.jpg', '/pexels-omar2.jpg', '/pexels-omar3.jpg', '/pexels-omar4.jpg'];

async function fetchUser(): Promise<User | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // 1) issue short-lived token for this table
  const token = signDbToken({ table: 'users', ttlSec: 60 });

  // 2) call PostgREST with the custom token
  const res = await fetch(`${url}/rest/v1/users?id=eq.1&select=id,name`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anon,
      Accept: 'application/json',
    },
    // optional: cache: 'no-store' if you want fresh data every request
    next: { revalidate: 0 },
  });

  if (!res.ok) return null;
  const rows = (await res.json()) as User[];
  return rows[0] ?? null;
}

export default async function Home() {
  const user = await fetchUser();

  return (
    <div className="min-w-screen flex flex-col">
      {/* Client carousel */}
      <Carousel images={imageUrls} />

      <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center flex-1 p-8 pb-20 gap-16 sm:p-20">
        <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
          <Image className="dark:invert" src="/next.svg" alt="Next.js logo" width={180} height={38} priority />
          {user ? (
            <p className="text-lg font-semibold">Hello, {user.name}!</p>
          ) : (
            <p className="text-sm text-gray-500">Loading user...</p>
          )}
          {/* ...rest of your markup unchanged... */}
        </main>
        {/* footer unchanged */}
      </div>
    </div>
  );
}
