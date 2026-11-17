import { createContext, useContext } from 'react';

// Keep the mounted login screen alive during its own successful sign-in handoff.
export const AuthTransitionContext = createContext<((active: boolean) => void) | null>(null);

export function useAuthTransition() {
  const setActive = useContext(AuthTransitionContext);
  if (!setActive) throw new Error('AuthTransitionContext must be provided by the auth layout.');
  return setActive;
}
