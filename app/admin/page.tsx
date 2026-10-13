import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';

async function countRows(table: 'users' | 'products' | 'orders' | 'categories') {
  try {
    const result = await db.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    return Number(result.rows[0]?.count ?? 0);
  } catch {
    return null;
  }
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/admin/login');

  const roleResult = await db.query(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
       AND r.name IN ('Super Admin', 'Operations Admin', 'Catalog Manager', 'Finance Manager', 'Support Agent', 'AI Factory Manager', 'Read-Only Analyst')
     ORDER BY CASE WHEN r.name = 'Super Admin' THEN 0 ELSE 1 END
     LIMIT 1`,
    [session.user.id],
  );
  if (!roleResult.rowCount) redirect('/account');

  const [users, products, orders, categories] = await Promise.all([
    countRows('users'),
    countRows('products'),
    countRows('orders'),
    countRows('categories'),
  ]);
  const roleName = String(roleResult.rows[0]?.name ?? 'Administrator');
  const metric = (value: number | null) => value === null ? '—' : value.toLocaleString('en-US');

  return (
    <main className="page">
      <div className="card">
        <span className="eyebrow">PRIVATE ADMINISTRATION</span>
        <h1>DigiNanba Admin Dashboard</h1>
        <p>Signed in as {session.user.email ?? session.user.name ?? 'administrator'}.</p>
        <p><strong>Access role:</strong> {roleName}</p>
        <div className="account-grid">
          <div><h3>Registered users</h3><p>{metric(users)}</p></div>
          <div><h3>Products</h3><p>{metric(products)}</p></div>
          <div><h3>Orders</h3><p>{metric(orders)}</p></div>
          <div><h3>Categories</h3><p>{metric(categories)}</p></div>
        </div>
        <h2>Administration areas</h2>
        <div className="account-grid">
          <div><h3>Catalog management</h3><p>Review product records, editions, prices and publishing status.</p></div>
          <div><h3>Users and access</h3><p>Review administrator roles and access-control foundations.</p></div>
          <div><h3>Orders and finance</h3><p>Monitor order records and prepare for payment and settlement operations.</p></div>
          <div><h3>AI Product Factory</h3><p>Private product-generation operations. Factory controls are not exposed until their permissions and workflows are verified.</p></div>
        </div>
        <p className="muted">Summary counts are read from the production database. A dash means that a table could not be queried; it does not mean the count is zero.</p>
      </div>
    </main>
  );
}
