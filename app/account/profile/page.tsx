import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ProfileForm } from '../AccountSettingsClient';
export default async function ProfilePage(){const s=await auth();if(!s?.user?.id)return null;const r=await db.query('SELECT id,email,display_name,status,created_at FROM users WHERE id=$1',[s.user.id]);if(!r.rows[0])return null;return <main className="account-page"><div className="account-container"><Back title="Profile"/><div className="account-detail"><span className="account-eyebrow">ACCOUNT INFORMATION</span><h1>Profile</h1><p className="account-lead">Update the name shown across your DigiNanba account.</p><ProfileForm initial={r.rows[0]}/></div></div></main>}
function Back({title}:{title:string}){return <div className="account-breadcrumb"><Link href="/account">My Account</Link><span>›</span><strong>{title}</strong></div>}
