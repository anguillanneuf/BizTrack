
'use client';

import {
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
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
 * Initiates Google Sign-In using a popup.
 * Does NOT await the operation internally.
 */
export function initiateGoogleSignIn(auth: Auth) {
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider)
    .catch(error => {
      console.error(`Google sign-in error:`, error);
      // Specific error handling (e.g., auth/popup-closed-by-user) can be done
      // in the component calling this, based on the error object.
    });
  // Execution continues immediately. The auth state listener will handle the result.
}
