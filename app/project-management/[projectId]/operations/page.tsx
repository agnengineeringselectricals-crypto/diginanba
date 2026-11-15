import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import OperationsWorkspace from './OperationsWorkspace';

export const dynamic='force-dynamic';

export default async function ProjectOperationsPage({params}:{params:Promise<{projectId:string}>}) {
 const session=await auth();
 if(!session?.user?.id) redirect('/login');
 const {projectId}=await params;
 return <OperationsWorkspace projectId={projectId}/>;
}
