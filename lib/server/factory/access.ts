import 'server-only';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isFactoryAuthorized } from './access-policy';

export type FactoryAccess = { userId: string; roles: string[] };

export class FactoryAccessError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? 'Authentication required.' : 'Factory manager access required.');
  }
}

export async function requireFactoryAccess(mode: 'view' | 'manage' = 'view'): Promise<FactoryAccess> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new FactoryAccessError(401);
  const result = await db.query<{ name: string }>(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id
     WHERE ur.user_id=$1 AND r.name = ANY($2::text[])`,
    [userId, mode === 'manage'
      ? ['Super Admin', 'Operations Admin', 'AI Factory Manager']
      : ['Super Admin', 'Operations Admin', 'AI Factory Manager', 'Read-Only Analyst']],
  );
  const roles=result.rows.map((row)=>row.name);
  if (!isFactoryAuthorized(roles,mode)) throw new FactoryAccessError(403);
  return { userId, roles };
}
