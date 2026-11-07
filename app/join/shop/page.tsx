import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ShopRegistration from './ShopRegistration';

export const metadata = { title: 'Register your shop | DigiNanba' };

export default async function JoinShopPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user) {
    const callbackUrl = '/join/shop' + (params.invite ? '?invite=' + encodeURIComponent(params.invite) : '');
    redirect('/signup?callbackUrl=' + encodeURIComponent(callbackUrl));
  }
  return <ShopRegistration invitationCode={params.invite || ''} />;
}
