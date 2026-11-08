import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import InviteShopOwner from './InviteShopOwner';

export const metadata = { title: 'Invite a shop owner | DigiNanba' };

export default async function InviteShopPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccount%2Finvite-shop');
  return <InviteShopOwner />;
}
