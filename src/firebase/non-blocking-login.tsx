
'use client';

import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  UserCredential,
} from 'firebase/auth';

/**
 * Initiates email and password sign-in.
 * Does NOT await the operation internally.
 */
export function initiateEmailSignIn(auth: Auth, email: string, password: string) {
  signInWithEmailAndPassword(auth, email, password)
    .catch(error => console.error(`Email sign-in error:`, error));
  // Execution continues immediately. The auth state listener will handle the result.
}

/**
 * Initiates email and password sign-up.
 * Does NOT await the operation internally for the auth state change,
 * but createUserWithEmailAndPassword itself returns a Promise<UserCredential>
 * which might be awaited by the caller if initial profile setup depends on it.
 * For truly non-blocking UI, rely on onAuthStateChanged.
 */
export function initiateEmailSignUp(auth: Auth, email: string, password: string) {
  // This function is often awaited in signup flows to get UserCredential for profile creation.
  // However, for strict non-blocking UI that relies only on onAuthStateChanged,
  // you would not await this in the component.
  // Since the signup page in this project *does* await `createUserWithEmailAndPassword`,
  // this function is provided for completeness but might not be used if signup directly calls the SDK.
  createUserWithEmailAndPassword(auth, email, password)
    .catch(error => console.error(`Email sign-up error:`, error));
}

/**
 * Initiates anonymous sign-in.
 * Does NOT await the operation internally.
 */
export function initiateAnonymousSignIn(auth: Auth) {
  signInAnonymously(auth)
    .catch(error => console.error(`Anonymous sign-in error:`, error));
  // Execution continues immediately. The auth state listener will handle the result.
}

/**
 * Initiates Google Sign-In using a popup, with a redirect fallback.
 */
export async function initiateGoogleSignIn(auth: Auth) {
  const provider = new GoogleAuthProvider();
  try {
    // We await here to catch the error and decide on the fallback.
    await signInWithPopup(auth, provider);
  } catch (error: any) {
    // If popup is blocked or closed by user, fall back to redirect method.
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      console.log('Popup failed, falling back to redirect.');
      // The page will redirect, and the result is handled by getRedirectResult on page load.
      await signInWithRedirect(auth, provider);
    } else {
      console.error('Google Sign-In error:', error);
      // For other errors, re-throw or handle as needed. This will be caught by the component.
      throw error;
    }
  }
}

/**
 * Checks for a redirect result from Google Sign-In.
 * This should be called when the application loads (e.g., in AppLayout) to complete
 * the sign-in flow after a redirect.
 * Returns the UserCredential if sign-in was successful, otherwise null.
 */
export async function checkGoogleRedirectResult(auth: Auth): Promise<UserCredential | null> {
    try {
        const result = await getRedirectResult(auth);
        return result;
    } catch (error) {
        console.error("Error getting redirect result:", error);
        return null;
    }
}
