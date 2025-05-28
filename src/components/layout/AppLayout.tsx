'use client';

import React, { type ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useUser, useAuth } from '@/firebase';
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
  return item ? item.label : 'BizTrack';
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(true); // Default open for desktop

  const currentPageTitle = getPageTitle(pathname);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router]);

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

  const userDisplayName = user.displayName || user.email?.split('@')[0] || 'User';
  const userEmail = user.email || 'No email';
  const userAvatarFallback = userDisplayName.substring(0, 1).toUpperCase();


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
          <UserNav user={user} onLogout={handleLogout} displayName={userDisplayName} email={userEmail} avatarFallback={userAvatarFallback} />
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

interface UserNavProps {
  user: any; // Firebase User type
  onLogout: () => void;
  displayName: string;
  email: string;
  avatarFallback: string;
}

function UserNav({ user, onLogout, displayName, email, avatarFallback }: UserNavProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-primary/50">
            {user.photoURL ? (
                <AvatarImage src={user.photoURL} alt={displayName} />
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
        <DropdownMenuItem disabled>
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
