import { Suspense } from 'react';
import { AuthForm } from '@/components/AuthForm';

export const metadata = { title: 'Sign in · Dhaka Tesla Pool' };

// AuthForm reads ?next= from the URL, which needs a Suspense boundary in the App Router.
export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
