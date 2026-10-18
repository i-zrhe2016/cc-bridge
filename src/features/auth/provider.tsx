import { ClerkProvider } from '@clerk/nextjs';
import { shadcn } from '@clerk/ui/themes';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    return children;
  }
  return (
    <ClerkProvider appearance={{ theme: shadcn }} signInUrl="/auth/sign-in" signUpUrl="/auth/sign-in" signInForceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard">
      {children}
    </ClerkProvider>
  );
}
