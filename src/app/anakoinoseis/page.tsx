// Redirect old announcements page to unified articles page
import { redirect } from 'next/navigation';

export default function AnnouncementsPage() {
  redirect('/articles');
}
