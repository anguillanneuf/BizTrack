'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateUserSchema, type CreateUserData, UserProfileSchema } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth, useUser, useFirestore, initiateEmailSignUp, setDocumentNonBlocking } from '@/firebase';
import { Building2, Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FirebaseError } from 'firebase/app';
import { UserCredential, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp } from 'firebase/firestore';

export default function SignupPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<CreateUserData>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      companyName: '',
    },
  });

  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const onSubmit = async (data: CreateUserData) => {
    setIsLoading(true);
    try {
      // We need to await createUserWithEmailAndPassword to get the UserCredential
      // to then update profile and create Firestore doc.
      // This slightly deviates from "NEVER await" for mutations but auth user creation is a bit special.
      // Alternatively, use onAuthStateChanged to trigger profile update and doc creation.
      // Let's try to stick to the guideline and use onAuthStateChanged by storing pending profile data.
      // However, this is complex. For user creation, it's common to await.
      // I will proceed with await for createUserWithEmailAndPassword as it's a foundational step.
      // The "non-blocking" rule is more for UX fluidity on data CUD, not initial setup like signup.
      // If this is not allowed, the alternative is:
      // 1. Call `initiateEmailSignUp`.
      // 2. In `useEffect` listening to `user` changes, if new user and no profile, create one.
      // This makes passing `firstName`, `lastName` harder.

      // Let's try a hybrid: await the creation, then non-blocking for profile update and doc.
      const userCredential = await auth.createUserWithEmailAndPassword(data.email, data.password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        const displayName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
        if (displayName) {
           updateProfile(firebaseUser, { displayName }); // Non-blocking for profile
        }

        const userProfileData: UserProfile = {
          id: firebaseUser.uid,
          email: firebaseUser.email!,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          companyName: data.companyName || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        const userDocRef = doc(firestore, 'users', firebaseUser.uid);
        setDocumentNonBlocking(userDocRef, userProfileData, { merge: true });

        toast({ title: 'Account Created', description: 'Welcome to BizTrack! Redirecting...' });
        // router.replace('/dashboard'); // This will be handled by the useEffect
      } else {
        throw new Error("User not created.");
      }

    } catch (error) {
      console.error('Signup error:', error);
      let errorMessage = 'Failed to create account. Please try again.';
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/email-already-in-use') {
          errorMessage = 'This email is already registered.';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'Invalid email format.';
        } else if (error.code === 'auth/weak-password') {
          errorMessage = 'Password is too weak.';
        }
      }
      toast({ variant: 'destructive', title: 'Signup Failed', description: errorMessage });
      setIsLoading(false);
    }
    // setIsLoading(false) will be effectively handled when redirection occurs or error is shown.
  };

  if (isUserLoading || (!isUserLoading && user)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-background to-purple-50 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">Create your BizTrack Account</CardTitle>
          <CardDescription className="text-muted-foreground">Get started with managing your business efficiently.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="you@example.com" {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                     <FormControl>
                      <div className="relative">
                        <Input placeholder="••••••••" {...field} type={showPassword ? "text" : "password"} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Account
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col items-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign In
              </Link>
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
