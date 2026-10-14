"use server";

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function assignTeamMembership(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect('/admin/login');

  const allowed = await db.query(
    `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.name = 'Super Admin' LIMIT 1`,
    [session.user.id],
  );
  if (!allowed.rowCount) throw new Error('Only a Super Admin can assign organization memberships.');

  const userId = String(formData.get('userId') ?? '').trim();
  const departmentId = String(formData.get('departmentId') ?? '').trim();
  const teamId = String(formData.get('teamId') ?? '').trim();
  const roleCode = String(formData.get('roleCode') ?? '').trim();
  const jobTitle = String(formData.get('jobTitle') ?? '').trim().slice(0, 100);
  if (!userId || !departmentId || !['sub_admin', 'team_leader', 'staff'].includes(roleCode)) {
    throw new Error('Choose a valid user, department and role.');
  }
  if ((roleCode === 'team_leader' || roleCode === 'staff') && !teamId) {
    throw new Error('Choose a team for team leaders and staff.');
  }
  if (roleCode === 'sub_admin' && teamId) {
    throw new Error('Department sub-admins are assigned to a department, not a single team.');
  }

  const validUser = await db.query(
    `SELECT id FROM users WHERE id = $1 AND status = 'active' LIMIT 1`,
    [userId],
  );
  if (!validUser.rowCount) throw new Error('The selected user does not exist or is not active.');

  const validDepartment = await db.query(
    `SELECT id FROM admin_departments WHERE id = $1 AND COALESCE(to_jsonb(admin_departments)->>'status','active') = 'active' LIMIT 1`,
    [departmentId],
  );
  if (!validDepartment.rowCount) throw new Error('Choose an active department.');

  if (teamId) {
    const validTeam = await db.query(
      `SELECT id FROM admin_teams WHERE id = $1 AND department_id = $2 LIMIT 1`,
      [teamId, departmentId],
    );
    if (!validTeam.rowCount) throw new Error('The selected team does not belong to the selected department.');
  }

  const duplicate = await db.query(
    `SELECT 1 FROM admin_staff_memberships
     WHERE user_id = $1 AND department_id = $2
       AND COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid) =
           COALESCE(NULLIF($3, '')::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
       AND status IN ('active','invited') LIMIT 1`,
    [userId, departmentId, teamId],
  );
  if (duplicate.rowCount) throw new Error('This user already has an active or invited membership for that department/team.');

  await db.query(
    `INSERT INTO admin_staff_memberships
       (user_id, department_id, team_id, role_code, job_title, status, invited_by, joined_at)
     VALUES ($1, $2, NULLIF($3, '')::uuid, $4, $5, 'active', $6, now())`,
    [userId, departmentId, teamId, roleCode, jobTitle, session.user.id],
  );
  revalidatePath('/admin/team');
  redirect('/admin/team?assigned=1');
}
