import 'server-only';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function requireProductFactoryAccess() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, status: 401, error: 'Authentication required' };

  const result = await db.query(
    `SELECT 1
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1 AND p.key = 'product_factory.manage'
     LIMIT 1`,
    [userId],
  );
  if (!result.rows.length) return { ok: false as const, status: 403, error: 'Not authorized' };
  return { ok: true as const, userId };
}
