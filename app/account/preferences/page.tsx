'use client';
import Link from 'next/link';
import { PreferencesForm } from '../AccountSettingsClient';
export default function PreferencesPage(){return <main className="account-page"><div className="account-container"><div className="account-breadcrumb"><Link href="/account">My Account</Link><span>›</span><strong>Preferences</strong></div><div className="account-detail"><span className="account-eyebrow">PERSONALIZATION</span><h1>Preferences</h1><p className="account-lead">Choose how DigiNanba presents products and sends account updates. These preferences are saved on this device in this release.</p><PreferencesForm/></div></div></main>}
