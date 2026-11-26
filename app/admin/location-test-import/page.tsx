import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import UploadCsv from './UploadCsv';

export const dynamic = 'force-dynamic';

export default async function LocationTestImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const role = await db.query(
    `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1 AND r.name = 'Super Admin' LIMIT 1`,
    [session.user.id],
  );
  if (!role.rowCount) redirect('/account');

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">DigiNanba · Admin</p>
      <h1 className="mt-2 text-2xl font-bold text-gray-950">Tamil Nadu location test import</h1>
      <p className="mt-3 text-sm leading-6 text-gray-600">
        This one-time import writes only to <code>location_test.tamilnadu_official_villages</code>.
        It does not modify the live marketplace location tables.
      </p>
      <UploadCsv />
      <p className="mt-4 text-xs leading-5 text-gray-500">
        Restricted to Super Admin. The import accepts the approved 17,379-row CSV only and refuses to run if the staging table already contains records.
      </p>
    </main>
  );
}
