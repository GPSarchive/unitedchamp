import Image from 'next/image';
import { signDbToken } from '@/app/lib/signDbToken';
import { Carousel } from '@/app/components/HomePageComponents/Carousel';
import EventCalendar from './components/HomePageComponents/Calendar';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';

type User = { id: number; name: string };

const imageUrls = ['/pexels-omar.jpg', '/pexels-omar2.jpg', '/pexels-omar3.jpg', '/pexels-omar4.jpg'];

export default async function Home() {
  // Fetch user data server-side using the service role key (admin access)
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('*')
    .limit(1)
    .single();

  if (userError) {
    console.error('Error fetching user:', userError.message);
  }

  // Type assertion for user
  const typedUser = user as User | null;

  // Placeholder events with teams and logos for team-vs-team rendering
  const placeholderEvents = [
    {
      id: '1',
      title: 'Lions vs Tigers',
      start: '2025-08-04T20:00:00',
      end: '2025-08-04T20:50:00',
      all_day: false,
      teams: ['Lions', 'Tigers'],
      logos: ['/logos/lions.png', '/logos/tigers.png'],
    },
    {
      id: '2',
      title: 'Eagles vs Hawks',
      start: '2025-08-04T20:50:00',
      end: '2025-08-04T21:40:00',
      all_day: false,
      teams: ['Eagles', 'Hawks'],
      logos: ['/logos/eagles.png', '/logos/hawks.png'],
    },
    {
      id: '3',
      title: 'Wolves vs Bears',
      start: '2025-08-05T21:00:00',
      end: '2025-08-05T21:50:00',
      all_day: false,
      teams: ['Wolves', 'Bears'],
      logos: ['/logos/wolves.png', '/logos/bears.png'],
    },
    {
      id: '4',
      title: 'Panthers vs Cougars',
      start: '2025-08-06T20:00:00',
      end: '2025-08-06T20:50:00',
      all_day: false,
      teams: ['Panthers', 'Cougars'],
      logos: ['/logos/panthers.png', '/logos/cougars.png'],
    },
    {
      id: '5',
      title: 'Falcons vs Ravens',
      start: '2025-08-06T20:50:00',
      end: '2025-08-06T21:40:00',
      all_day: false,
      teams: ['Falcons', 'Ravens'],
      logos: ['/logos/falcons.png', '/logos/ravens.png'],
    },
  ];

  // Use placeholder events since no DB table exists
  const eventsToPass = placeholderEvents;

  return (
    <div className="min-w-screen flex flex-col">
      {/* Client carousel */}
      <Carousel images={imageUrls} />

      <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center flex-1 p-8 pb-20 gap-16 sm:p-20">
        <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
          <Image className="dark:invert" src="/next.svg" alt="Next.js logo" width={180} height={38} priority />
          {typedUser ? (
            <p className="text-lg font-semibold">Hello, {typedUser.name}!</p>
          ) : (
            <p className="text-sm text-gray-500">Loading user...</p>
          )}
          
          <EventCalendar initialEvents={eventsToPass} fetchFromDb={false} />
        </main>
      </div>
    </div>
  );
}