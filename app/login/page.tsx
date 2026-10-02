'use client';
import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
export default function LoginPage() {
  const router = useRouter(); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError('');const result=await signIn('credentials',{email,password,redirect:false});setLoading(false);if(!result?.ok)return setError('Email or password is incorrect.');router.push('/account');router.refresh();}
  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}><a href="/" className="brand">DigiNanba</a><h1>Welcome back</h1><p>Sign in to access your DigiNanba account and downloads.</p>{error&&<div className="error">{error}</div>}<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" /></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" /></label><button className="primary" disabled={loading}>{loading?'Signing in…':'Sign in'}</button><div className="auth-foot">New to DigiNanba? <a href="/signup">Create an account</a></div></form></main>;
}
