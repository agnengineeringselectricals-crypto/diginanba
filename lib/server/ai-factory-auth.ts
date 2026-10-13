import 'server-only';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export type FactoryAccess =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string };

export async function requireFactoryManager(): Promise<FactoryAccess> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, status: 401, error: 'Authentication required' };

  const result = await db.query(
    `SELECT 1
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
        AND r.name IN ('Super Admin', 'AI Factory Manager')
      LIMIT 1`,
    [userId],
  );

  if (!result.rowCount) {
    return { ok: false, status: 403, error: 'AI Factory Manager permission required' };
  }

  return { ok: true, userId: String(userId) };
}
