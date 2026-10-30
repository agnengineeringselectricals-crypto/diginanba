'use client';

import { signOut } from 'next-auth/react';

export default function AccountSignOut() {
  return (
    <button
      type="button"
      className="dn-account-signout"
      onClick={() => signOut({ callbackUrl: '/' })}
    >
      Sign out
    </button>
  );
}
