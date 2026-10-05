import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { FactoryAccessError, requireFactoryAccess } from '@/lib/server/factory/access';
import FactoryDashboard from './FactoryDashboard';

export default async function FactoryPage(){
  const session=await auth();
  if(!session?.user) redirect('/login');
  try{await requireFactoryAccess('view');}
  catch(error){
    if(error instanceof FactoryAccessError && error.status===403) redirect('/account');
    return <main className="page"><section className="card"><span className="eyebrow">PRIVATE FACTORY</span><h1>Factory dashboard unavailable</h1><p>Configure the database and apply the latest <code>db/schema.sql</code> before opening factory operations.</p></section></main>;
  }
  return <FactoryDashboard />;
}
