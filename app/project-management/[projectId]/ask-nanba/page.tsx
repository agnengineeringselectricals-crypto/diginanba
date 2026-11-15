import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import AskNanbaWorkspace from './AskNanbaWorkspace';

export const dynamic = 'force-dynamic';

export default async function AskNanbaPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const { projectId } = await params;
  const project = await db.query(
    `SELECT p.name FROM pm_projects p
     JOIN organization_memberships m ON m.organization_id=p.organization_id
     LEFT JOIN pm_memberships mine ON mine.organization_id=p.organization_id AND mine.user_id=$2 AND mine.status='active'
     LEFT JOIN pm_project_members pmx ON pmx.project_id=p.id AND pmx.organization_id=p.organization_id AND pmx.membership_id=mine.id AND pmx.status='active'
     WHERE p.id=$1 AND p.status<>'archived' AND m.user_id=$2 AND m.status='active'
       AND (m.role IN ('owner','admin') OR pmx.membership_id IS NOT NULL)
     LIMIT 1`,
    [projectId, session.user.id],
  );
  if (!project.rows[0]) redirect('/project-management');
  return <AskNanbaWorkspace projectId={projectId} projectName={project.rows[0].name} />;
}
