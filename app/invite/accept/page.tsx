import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import InvitationAcceptance from './InvitationAcceptance';

export const metadata = { title: 'Accept DigiNanba invitation' };

export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = params.token || '';
  if (!token) return <main style={{maxWidth:560,margin:'12vh auto',padding:24}}><h1>Invitation link is incomplete</h1><a href="/">Return to DigiNanba</a></main>;
  const session = await auth();
  if (!session?.user) {
    const callbackUrl = '/invite/accept?token=' + encodeURIComponent(token);
    redirect('/signup?callbackUrl=' + encodeURIComponent(callbackUrl));
  }
  return <InvitationAcceptance />;
}
