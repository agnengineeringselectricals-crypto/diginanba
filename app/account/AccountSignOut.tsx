'use client';
import { signOut } from 'next-auth/react';
export default function AccountSignOut(){return <button className="account-danger-link" onClick={()=>signOut({callbackUrl:'/'})}>Sign out</button>}
