import { SignIn } from '@clerk/react';
import { PATHS } from '../access';

export default function SignInPage() {
  return <SignIn routing="path" path={PATHS.signIn} signUpUrl={PATHS.signUp} />;
}
