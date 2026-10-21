import { SignIn } from '@clerk/react';
import { useDocumentMeta } from '@/shared/hooks';
import { PATHS } from '../access';

export default function SignInPage() {
  useDocumentMeta('Sign in');
  return <SignIn routing="path" path={PATHS.signIn} signUpUrl={PATHS.signUp} />;
}
