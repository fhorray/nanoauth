import { useStore } from '@nanostores/react';
import { createAuthClient as createBaseClient, type AuthClientOptions } from './client';

/**
 * NanoAuth React Factory
 * 
 * Creates a specialized client that provides a unified React Hook
 * for consuming all authentication state and methods elegantly.
 */
export function createAuthClient(options?: AuthClientOptions) {
  const client = createBaseClient(options);

  /**
   * Unified Unified Authentication Hook
   * 
   * Returns a single object containing:
   * - user: The current authenticated user
   * - token: The session token
   * - isLoading: The current loading state of the client
   * - error: Any error message from the client
   * - signIn: Method to perform sign in
   * - signUp: Method to perform registration
   * - signOut: Method to sign out
   */
  const useSession = () => {
    const session = useStore(client.session);
    const isLoading = useStore(client.isLoading);
    const error = useStore(client.error);

    return {
      user: session.user,
      token: session.token,
      isLoading,
      error,
      signIn: client.signIn,
      signUp: client.signUp,
      signOut: client.signOut
    };
  };

  return {
    useSession,
    // Original stores for advanced use cases
    $stores: {
      session: client.session,
      isLoading: client.isLoading,
      error: client.error
    },
    // Original methods
    signIn: client.signIn,
    signUp: client.signUp,
    signOut: client.signOut
  };
}
