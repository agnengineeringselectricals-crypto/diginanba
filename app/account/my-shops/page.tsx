import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import MyShopsManager from './MyShopsManager';

export const metadata = { title: 'My Shop Dashboard | DigiNanba' };

export default async function MyShopDashboardPage() {
  const session=await auth();
  if(!session?.user)redirect('/login?callbackUrl=%2Faccount%2Fmy-shops');
  return <MyShopsManager />;
}
