'use client';

import { SignUp } from '@clerk/nextjs';
import { useTheme } from '@/src/lib/theme';

export default function SignUpPage() {
  const { theme } = useTheme();
  return (
    <main className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
      <SignUp
        appearance={{
          variables: {
            colorPrimary: '#D85A30',
            colorBackground: theme === 'dark' ? '#1a1a19' : '#ffffff',
            colorText: theme === 'dark' ? '#e8e8e6' : '#0d0d0c',
            colorTextSecondary: theme === 'dark' ? '#a8a89e' : '#6b6b65',
            colorNeutral: theme === 'dark' ? '#e8e8e6' : '#0d0d0c',
            colorInputBackground: theme === 'dark' ? '#262625' : '#f5f5f4',
            colorInputText: theme === 'dark' ? '#e8e8e6' : '#0d0d0c',
          },
          elements: {
            socialButtonsIconButton: theme === 'dark'
              ? 'bg-[#2e2e2c] border border-[rgba(255,255,255,0.12)] hover:bg-[#3a3a38]'
              : undefined,
            providerIcon__apple: theme === 'dark' ? { filter: 'invert(1)' } : undefined,
          },
        }}
      />
    </main>
  );
}
