
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  UpdateProfileInfoFormSchema, 
  type UpdateProfileInfoFormData, 
  ChangePasswordFormSchema, 
  type ChangePasswordFormData,
  type UserProfile
} from '@/types';
import { useUser, useAuth, useFirestore, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { updateProfile as updateAuthProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Loader2, UserCircle, Lock, Eye, EyeOff, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FirebaseError } from 'firebase/app';

export default function ProfilePage() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isProfileInfoSubmitting, setIsProfileInfoSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const userProfileRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userProfileRef);

  const profileInfoForm = useForm<UpdateProfileInfoFormData>({
    resolver: zodResolver(UpdateProfileInfoFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      companyName: '',
      photoFile: undefined,
    },
  });

  const passwordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(ChangePasswordFormSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (userProfile) {
      profileInfoForm.reset({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        companyName: userProfile.companyName || '',
        photoFile: undefined, // File input cannot be pre-filled programmatically for security reasons
      });
      if (userProfile.photoURL) {
        setPreviewImage(userProfile.photoURL);
      } else if (user?.photoURL) {
        setPreviewImage(user.photoURL);
      }
    } else if (user && !isLoadingProfile) { // If userProfile doc doesn't exist but auth user does
        profileInfoForm.reset({
            firstName: user.displayName?.split(' ')[0] || '',
            lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
            companyName: '',
            photoFile: undefined,
        });
        if (user.photoURL) {
            setPreviewImage(user.photoURL);
        }
    }
  }, [userProfile, user, profileInfoForm, isLoadingProfile]);

  const handleProfileInfoSubmit = async (data: UpdateProfileInfoFormData) => {
    if (!user || !firestore) return;
    setIsProfileInfoSubmitting(true);

    let photoURLToUpdate: string | null = userProfile?.photoURL || user?.photoURL || null;

    if (data.photoFile && data.photoFile.length > 0) {
      const file = data.photoFile[0];
      photoURLToUpdate = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    
    const displayName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || user.displayName;

    try {
      // Update Firebase Auth profile
      await updateAuthProfile(user, {
        displayName: displayName,
        photoURL: photoURLToUpdate,
      });

      // Update Firestore profile document
      const profileDataToSave: Partial<UserProfile> = {
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        companyName: data.companyName || '',
        photoURL: photoURLToUpdate || '', // Store empty string if null to clear
        email: user.email!, // Ensure email is part of the profile
        updatedAt: serverTimestamp(),
      };
      if (!userProfile) { // If profile doc didn't exist, add createdAt
        profileDataToSave.createdAt = serverTimestamp();
      }
      
      updateDocumentNonBlocking(userProfileRef!, profileDataToSave, { merge: true });

      toast({ title: 'Profile Updated', description: 'Your profile information has been saved.' });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update profile.' });
    } finally {
      setIsProfileInfoSubmitting(false);
    }
  };

  const handleChangePasswordSubmit = async (data: ChangePasswordFormData) => {
    if (!user) return;
    setIsPasswordSubmitting(true);

    try {
      await updatePassword(user, data.newPassword);
      toast({ title: 'Password Changed', description: 'Your password has been updated successfully.' });
      passwordForm.reset();
    } catch (error) {
      console.error('Error changing password:', error);
      let description = 'Could not change password.';
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/requires-recent-login') {
          description = 'This operation is sensitive and requires recent authentication. Please log out and log back in to change your password.';
        } else if (error.code === 'auth/weak-password') {
          description = 'The new password is too weak.';
        }
      }
      toast({ variant: 'destructive', title: 'Password Change Failed', description });
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewImage(userProfile?.photoURL || user?.photoURL || null); // Revert to original if no file selected
    }
  };
  
  const currentAvatarFallback = (userProfile?.firstName || user?.displayName || 'U').substring(0,1).toUpperCase();

  if (isLoadingProfile && !userProfile) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-full">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }


  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <Card className="max-w-2xl mx-auto shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl flex items-center">
              <UserCircle className="mr-3 h-8 w-8 text-primary" /> User Profile
            </CardTitle>
            <CardDescription>Manage your personal information and security settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="info">Profile Information</TabsTrigger>
                <TabsTrigger value="password">Change Password</TabsTrigger>
              </TabsList>
              
              <TabsContent value="info">
                <Form {...profileInfoForm}>
                  <form onSubmit={profileInfoForm.handleSubmit(handleProfileInfoSubmit)} className="space-y-6">
                    <div className="flex flex-col items-center space-y-4 mb-6">
                       <Avatar className="h-32 w-32 border-4 border-primary/30">
                        <AvatarImage src={previewImage || undefined} alt="Profile Preview" data-ai-hint="profile avatar" />
                        <AvatarFallback className="text-4xl bg-muted">{currentAvatarFallback}</AvatarFallback>
                      </Avatar>
                      <FormField
                        control={profileInfoForm.control}
                        name="photoFile"
                        render={({ field }) => (
                          <FormItem className="w-full max-w-xs">
                            <FormLabel htmlFor="photoFile" className="sr-only">Profile Picture</FormLabel>
                            <FormControl>
                              <Input 
                                id="photoFile"
                                type="file" 
                                accept="image/*"
                                className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                onChange={(e) => {
                                  field.onChange(e.target.files);
                                  handleFileChange(e);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={profileInfoForm.control} name="firstName"
                        render={({ field }) => (
                          <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>
                        )}
                      />
                      <FormField
                        control={profileInfoForm.control} name="lastName"
                        render={({ field }) => (
                          <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={profileInfoForm.control} name="companyName"
                      render={({ field }) => (
                        <FormItem><FormLabel>Company Name (Optional)</FormLabel><FormControl><Input placeholder="Acme Corp" {...field} /></FormControl><FormMessage /></FormItem>
                      )}
                    />
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <Input type="email" value={user?.email || ''} disabled className="bg-muted/50" />
                      <p className="text-xs text-muted-foreground mt-1">Email address cannot be changed.</p>
                    </FormItem>
                    <Button type="submit" className="w-full" disabled={isProfileInfoSubmitting}>
                      {isProfileInfoSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Profile Changes
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="password">
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(handleChangePasswordSubmit)} className="space-y-6">
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input type={showNewPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowNewPassword(!showNewPassword)}>
                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                             <div className="relative">
                              <Input type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={isPasswordSubmitting}>
                      {isPasswordSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Change Password
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
