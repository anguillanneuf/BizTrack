
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
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className} // Apply className here
  >
    <path d="M17.6402 9.20455C17.6402 8.56818 17.5818 7.95455 17.4752 7.36364H9V10.8409H13.8409C13.6352 11.9918 12.9802 12.9545 12.0452 13.5909V15.8352H14.9591C16.6752 14.2545 17.6402 11.9318 17.6402 9.20455Z" fill="#4285F4"/>
    <path d="M9.00023 7.36364C10.3052 7.36364 11.4502 7.78636 12.3802 8.64545L15.0102 6.07273C13.4602 4.65 11.4052 3.81818 9.00023 3.81818C6.54569 3.81818 4.44569 5.35455 3.59569 7.46818L6.42069 9.75909C6.88069 8.39091 7.84023 7.36364 9.00023 7.36364Z" fill="#34A853"/>
    <path d="M3.59569 10.5318C3.43069 10.0364 3.33569 9.5 3.33569 8.95455C3.33569 8.40909 3.43069 7.87273 3.59569 7.38182L0.770689 5.09091C0.270233 6.12273 0 7.29091 0 8.95455C0 10.6182 0.270233 11.7864 0.770689 12.8182L3.59569 10.5318Z" fill="#FBBC05"/>
    <path d="M9.00023 14.1818C10.4302 14.1818 11.6352 13.7318 12.5402 13.05L15.1202 15.5773C13.5902 16.9273 11.4352 17.7273 9.00023 17.7273C6.34023 17.7273 4.03523 16.0136 2.61023 13.7364L5.50523 11.3909C6.07023 13.05 7.39523 14.1818 9.00023 14.1818Z" fill="#EA4335"/>
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
