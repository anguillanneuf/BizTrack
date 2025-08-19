
'use client';

import React, { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useUser, useAuth, useDoc, useFirestore, setDocumentNonBlocking, checkGoogleRedirectResult } from '@/firebase';
import { signOut } from 'firebase/auth';
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarFooter, 
  SidebarInset,
  SidebarTrigger
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  DollarSign,
  CreditCard,
  CalendarDays,
  LogOut,
  User as UserIcon,
  Settings,
  Loader2,
  Building2,
  Menu,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/types';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/income', label: 'Income', icon: DollarSign },
  { href: '/expenses', label: 'Expenses', icon: CreditCard },
  { href: '/appointments', label: 'Appointments', icon: CalendarDays },
];

function getPageTitle(pathname: string): string {
  const item = navItems.find(navItem => pathname.startsWith(navItem.href));
  if (pathname.startsWith('/profile')) return 'User Profile';
  return item ? item.label : 'BizTrack';
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true); // Default open for desktop

  const currentPageTitle = getPageTitle(pathname);

  const userProfileRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isLoadingProfile } = useDoc<UserProfile>(userProfileRef);


  useEffect(() => {
    if (!isUserLoading && !user) {
      // Before redirecting to login, check for a redirect result
      checkGoogleRedirectResult(auth)
        .then(result => {
          if (!result) { // If no result, then proceed to login
            router.replace('/login');
          }
          // If there is a result, onAuthStateChanged will fire and handle the user state.
        })
        .catch(() => {
          // If there's an error checking, just go to login.
          router.replace('/login');
        });
    }
  }, [user, isUserLoading, router, auth]);

  // Effect to create user profile document if it doesn't exist (e.g., after new social sign-in)
  useEffect(() => {
    if (user && !isUserLoading && firestore && userProfileRef && userProfile === null && !isLoadingProfile) {
      // User is authenticated, Firestore is available, ref is defined, 
      // profile doc explicitly does not exist (null, not undefined), and not currently loading profile.
      console.log("AppLayout: Attempting to create missing user profile for UID:", user.uid);
      const newProfileData: UserProfile = {
        id: user.uid,
        email: user.email || '', // Google sign-in provides email
        firstName: user.displayName?.split(' ')[0] || '',
        lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      setDoc(userProfileRef, newProfileData, { merge: false })
      .then(() => {
        toast({ title: "Profile Created", description: "Your user profile has been automatically set up." });
      })
      .catch((error) => {
        console.error("AppLayout: Error creating user profile:", error);
        toast({ variant: "destructive", title: "Profile Creation Failed", description: "Could not set up your user profile." });
      });
  
      // setDocumentNonBlocking(userProfileRef, newProfileData, { merge: false }) // merge: false to ensure it's a new doc
        // .then(() => {
        //   toast({ title: "Profile Created", description: "Your user profile has been automatically set up." });
        // })
        // .catch((error) => {
        //   console.error("AppLayout: Error creating user profile:", error);
        //   toast({ variant: "destructive", title: "Profile Creation Failed", description: "Could not set up your user profile." });
        // });
    }
  }, [user, isUserLoading, userProfile, isLoadingProfile, firestore, userProfileRef, toast]);


  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logged out", description: "You have been successfully logged out." });
      router.push('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ variant: "destructive", title: "Logout Error", description: "Failed to log out. Please try again." });
    }
  };

  const authUserDisplayName = user.displayName || user.email?.split('@')[0] || 'User';
  const profileDisplayNameFromDoc = (userProfile?.firstName || userProfile?.lastName) 
    ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() 
    : null;
  
  const displayName = profileDisplayNameFromDoc || authUserDisplayName;
  const userEmail = user.email || 'No email';
  
  const authUserPhotoURL = user.photoURL;
  const profilePhotoURLFromDoc = userProfile?.photoURL;
  const displayPhotoURL = profilePhotoURLFromDoc || authUserPhotoURL;

  const userAvatarFallback = displayName.substring(0, 1).toUpperCase();


  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <Sidebar collapsible="icon">
        <SidebarHeader className="p-4">
          <Link href="/dashboard" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <Building2 className="h-8 w-8 text-sidebar-primary group-data-[collapsible=icon]:text-sidebar-foreground" />
            <span className="font-semibold text-lg text-sidebar-primary-foreground group-data-[collapsible=icon]:hidden">BizTrack</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton 
                    isActive={pathname.startsWith(item.href)} 
                    tooltip={{children: item.label}}
                    className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2 mt-auto">
          {/* Placeholder for settings or help, if needed */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-card px-4 sm:px-6 shadow-sm">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="block data-[open=true]:hidden" />
            <h1 className="text-xl font-semibold text-foreground">{currentPageTitle}</h1>
          </div>
          <UserNav 
            onLogout={handleLogout} 
            displayName={displayName} 
            email={userEmail} 
            avatarFallback={userAvatarFallback}
            photoURL={displayPhotoURL}
          />
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

interface UserNavProps {
  onLogout: () => void;
  displayName: string;
  email: string;
  avatarFallback: string;
  photoURL?: string | null;
}

function UserNav({ onLogout, displayName, email, avatarFallback, photoURL }: UserNavProps) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-primary/50">
            {photoURL ? (
                <AvatarImage src={photoURL} alt={displayName} data-ai-hint="user avatar" />
            ) : (
                <AvatarFallback className="bg-primary text-primary-foreground">{avatarFallback}</AvatarFallback>
            )}
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/profile')}>
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
