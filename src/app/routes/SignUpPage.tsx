import { SignUp } from '@clerk/react';
import { useDocumentMeta } from '@/shared/hooks';
import { PATHS } from '../access';

export default function SignUpPage() {
  useDocumentMeta('Register');
  return <SignUp routing="path" path={PATHS.signUp} signInUrl={PATHS.signIn} />;
}
