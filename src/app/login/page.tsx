
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginUserSchema, type LoginUserData } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth, useUser, initiateEmailSignIn, initiateAnonymousSignIn, initiateGoogleSignIn } from '@/firebase';
import { Building2, Loader2, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FirebaseError } from 'firebase/app';

// Simple SVG Google icon
const GoogleIcon = ({ className }: { className?: string }) => (
    <svg
    // version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48" 
    // xmlns:xlink="http://www.w3.org/1999/xlink" 
    className={className} 
    >
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
    <path fill="none" d="M0 0h48v48H0z"></path>
  </svg>
);


export default function LoginPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginUserData>({
    resolver: zodResolver(LoginUserSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const onSubmit = async (data: LoginUserData) => {
    setIsLoading(true);
    try {
      initiateEmailSignIn(auth, data.email, data.password);
      toast({ title: 'Login Initiated', description: 'Checking your credentials...' });
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Failed to login. Please check your credentials.';
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          errorMessage = 'Invalid email or password.';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'Invalid email format.';
        }
      }
      toast({ variant: 'destructive', title: 'Login Failed', description: errorMessage });
      setIsLoading(false); // Ensure loading stops on direct error
    }
    // Fallback to stop loading if auth state doesn't change quickly
    setTimeout(() => { if (isLoading) setIsLoading(false); }, 3000);
  };
  
  const handleAnonymousSignIn = () => {
    setIsLoading(true);
    try {
      initiateAnonymousSignIn(auth);
      toast({ title: 'Anonymous Login Initiated', description: 'Signing you in anonymously...' });
    } catch (error) {
      console.error('Anonymous login error:', error);
      toast({ variant: 'destructive', title: 'Login Failed', description: 'Could not sign in anonymously.' });
      setIsLoading(false);
    }
    setTimeout(() => { if (isLoading) setIsLoading(false); }, 3000);
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    try {
      initiateGoogleSignIn(auth);
      toast({ title: 'Google Sign-In Initiated', description: 'Redirecting to Google...' });
    } catch (error) {
      console.error('Google Sign-In error:', error);
      let errorMessage = 'Could not sign in with Google.';
      if (error instanceof FirebaseError) {
        // Handle specific Firebase errors for Google Sign-In if any
        if (error.code === 'auth/popup-closed-by-user') {
          errorMessage = 'Google Sign-In cancelled.';
        } else if (error.code === 'auth/network-request-failed') {
          errorMessage = 'Network error during Google Sign-In. Please check your connection.';
        }
      }
      toast({ variant: 'destructive', title: 'Google Sign-In Failed', description: errorMessage });
      setIsLoading(false);
    }
    // Fallback to stop loading, popup closure might not trigger auth state change if no user interaction.
    setTimeout(() => { if (isLoading) setIsLoading(false); }, 5000);
  };


  if (isUserLoading || (!isUserLoading && user)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-background to-blue-50 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <Building2 className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">Welcome to BizTrack</CardTitle>
          <CardDescription className="text-muted-foreground">Sign in to access your business dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                Sign In
              </Button>
            </form>
          </Form>
          <div className="my-4 flex items-center">
            <hr className="flex-grow border-border" />
            <span className="mx-2 text-xs text-muted-foreground">OR CONTINUE WITH</span>
            <hr className="flex-grow border-border" />
          </div>
          <Button variant="outline" size="lg" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon className="mr-2 h-4 w-4" />} 
            Sign in with Google
          </Button>
          <div className="mt-4 text-center text-sm">
            <Button variant="link" onClick={handleAnonymousSignIn} disabled={isLoading} className="px-0 text-primary">
              Sign in anonymously
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                Sign Up
              </Link>
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
