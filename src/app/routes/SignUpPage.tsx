import { SignUp } from '@clerk/react';
import { PATHS } from '../access';

export default function SignUpPage() {
  return <SignUp routing="path" path={PATHS.signUp} signInUrl={PATHS.signIn} />;
}
