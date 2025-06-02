
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, CreditCard, TrendingUp, CalendarClock, AlertTriangle, Loader2 } from 'lucide-react';
import { useUser, useFirestore, useCollection, useDoc, type WithId } from '@/firebase';
import { collection, query, orderBy, limit, doc, onSnapshot } from 'firebase/firestore';
import type { Income, Expense, Appointment, UserProfile } from '@/types';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip as ChartTooltip, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';

function StatCard({ title, value, icon: Icon, description, isLoading }: { title: string; value: string; icon: React.ElementType; description?: string; isLoading?: boolean }) {
  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        ) : (
          <div className="text-3xl font-bold text-foreground">{value}</div>
        )}
        {description && !isLoading && <p className="text-xs text-muted-foreground pt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const currentUserProfileRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: currentUserProfile, isLoading: isLoadingCurrentUserProfile } = useDoc<UserProfile>(currentUserProfileRef);

  // Fetch all user profiles to identify admins
  const allUsersQuery = useMemo(() => firestore ? query(collection(firestore, 'users')) : null, [firestore]);
  const { data: allUserProfiles, isLoading: isLoadingAllUserProfiles, error: allUserProfilesError } = useCollection<UserProfile>(allUsersQuery);

  const adminUids = useMemo(() => {
    if (!allUserProfiles) return [];
    return allUserProfiles.filter(p => p.role === 'admin').map(p => p.id);
  }, [allUserProfiles]);

  // --- Data fetching for current user ---
  const currentUserIncomeQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'incomes'));
  }, [firestore, user]);
  const { data: currentUserIncomes, isLoading: isLoadingCurrentUserIncomes, error: currentUserIncomeError } = useCollection<Income>(currentUserIncomeQuery);

  const currentUserExpensesQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'expenses'));
  }, [firestore, user]);
  const { data: currentUserExpenses, isLoading: isLoadingCurrentUserExpenses, error: currentUserExpenseError } = useCollection<Expense>(currentUserExpensesQuery);
  
  const currentUserAppointmentsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'appointments'), orderBy('startTime'), limit(5));
  }, [firestore, user]);
  const { data: currentUserAppointments, isLoading: isLoadingCurrentUserAppointments, error: currentUserAppointmentError } = useCollection<Appointment>(currentUserAppointmentsQuery);

  // --- State and useEffect for admin data ---
  const [adminIncomesData, setAdminIncomesData] = useState<Record<string, WithId<Income>[]>>({});
  const [isLoadingAdminIncomes, setIsLoadingAdminIncomes] = useState(false);
  const [adminIncomesError, setAdminIncomesError] = useState<Error | null>(null);

  const [adminExpensesData, setAdminExpensesData] = useState<Record<string, WithId<Expense>[]>>({});
  const [isLoadingAdminExpenses, setIsLoadingAdminExpenses] = useState(false);
  const [adminExpensesError, setAdminExpensesError] = useState<Error | null>(null);

  const [adminAppointmentsData, setAdminAppointmentsData] = useState<Record<string, WithId<Appointment>[]>>({});
  const [isLoadingAdminAppointments, setIsLoadingAdminAppointments] = useState(false);
  const [adminAppointmentsError, setAdminAppointmentsError] = useState<Error | null>(null);
  
  const fetchDataForAdmins = <T extends {id: string}>(
    entityName: string, 
    setData: React.Dispatch<React.SetStateAction<Record<string, WithId<T>[]>>>,
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setError: React.Dispatch<React.SetStateAction<Error | null>>,
    orderByField?: string,
    orderByDirection: "asc" | "desc" = "asc"
  ) => {
    if (!firestore || adminUids.length === 0 || !user) {
      setData({});
      setIsLoading(false);
      return () => {}; // Return empty cleanup
    }

    setIsLoading(true);
    setError(null);
    const unsubscribers: (() => void)[] = [];
    let activeFetches = 0;

    const uidsToFetch = adminUids.filter(uid => uid !== user.uid);
     if (uidsToFetch.length === 0) {
      setIsLoading(false);
      setData({});
      return () => {};
    }
    activeFetches = uidsToFetch.length;

    uidsToFetch.forEach(adminUid => {
      let q = query(collection(firestore, 'users', adminUid, entityName));
      if (orderByField) {
        q = query(q, orderBy(orderByField, orderByDirection));
      }

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const items = snapshot.docs.map(doc => ({ ...doc.data() as T, id: doc.id }));
          setData(prev => ({ ...prev, [adminUid]: items }));
          activeFetches--;
          if (activeFetches === 0) setIsLoading(false);
        }, 
        (err) => {
          console.error(`Error fetching ${entityName} for admin ${adminUid}:`, err);
          setError(err);
          activeFetches--;
          if (activeFetches === 0) setIsLoading(false);
        }
      );
      unsubscribers.push(unsubscribe);
    });
    return () => unsubscribers.forEach(unsub => unsub());
  };

  useEffect(() => fetchDataForAdmins<Income>('incomes', setAdminIncomesData, setIsLoadingAdminIncomes, setAdminIncomesError, 'date', 'desc'), [firestore, adminUids, user]);
  useEffect(() => fetchDataForAdmins<Expense>('expenses', setAdminExpensesData, setIsLoadingAdminExpenses, setAdminExpensesError, 'date', 'desc'), [firestore, adminUids, user]);
  useEffect(() => fetchDataForAdmins<Appointment>('appointments', setAdminAppointmentsData, setIsLoadingAdminAppointments, setAdminAppointmentsError, 'startTime', 'asc'), [firestore, adminUids, user]);


  // --- Merge data ---
  const allIncomes = useMemo(() => {
    let combined: WithId<Income>[] = currentUserIncomes ? [...currentUserIncomes] : [];
    Object.values(adminIncomesData).forEach(list => combined.push(...list));
    const uniqueMap = new Map(combined.map(item => [item.id, item]));
    return Array.from(uniqueMap.values());
  }, [currentUserIncomes, adminIncomesData]);

  const allExpenses = useMemo(() => {
    let combined: WithId<Expense>[] = currentUserExpenses ? [...currentUserExpenses] : [];
    Object.values(adminExpensesData).forEach(list => combined.push(...list));
    const uniqueMap = new Map(combined.map(item => [item.id, item]));
    return Array.from(uniqueMap.values());
  }, [currentUserExpenses, adminExpensesData]);

  const allAppointments = useMemo(() => {
    let combined: WithId<Appointment>[] = currentUserAppointments ? [...currentUserAppointments] : [];
    Object.values(adminAppointmentsData).forEach(list => combined.push(...list));
    const uniqueMap = new Map(combined.map(item => [item.id, item]));
    return Array.from(uniqueMap.values()).sort((a, b) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime());
  }, [currentUserAppointments, adminAppointmentsData]);


  const totalIncome = useMemo(() => allIncomes.reduce((sum, item) => sum + item.amount, 0), [allIncomes]);
  const totalExpenses = useMemo(() => allExpenses.reduce((sum, item) => sum + item.amount, 0), [allExpenses]);
  const profit = totalIncome - totalExpenses;

  const chartData = useMemo(() => [
    { name: 'Income', value: totalIncome, fill: 'hsl(var(--chart-1))' },
    { name: 'Expenses', value: totalExpenses, fill: 'hsl(var(--chart-2))' },
  ], [totalIncome, totalExpenses]);

  const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return allAppointments
        .filter(appt => parseISO(appt.startTime) > now)
        .slice(0,3);
  }, [allAppointments]);

  const globalIsLoading = isLoadingCurrentUserProfile || isLoadingAllUserProfiles || 
                          isLoadingCurrentUserIncomes || isLoadingAdminIncomes ||
                          isLoadingCurrentUserExpenses || isLoadingAdminExpenses ||
                          isLoadingCurrentUserAppointments || isLoadingAdminAppointments;

  const globalError = currentUserIncomeError || currentUserExpenseError || currentUserAppointmentError ||
                      adminIncomesError || adminExpensesError || adminAppointmentsError || allUserProfilesError;

  if (globalError) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full text-destructive">
          <AlertTriangle className="w-16 h-16 mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Error loading data</h2>
          <p>Could not load dashboard information. Please try again later.</p>
          <p className="text-sm mt-1">Error: {globalError.message}</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Total Revenue" value={currencyFormatter.format(totalIncome)} icon={DollarSign} description="All income recorded" isLoading={globalIsLoading} />
          <StatCard title="Total Expenses" value={currencyFormatter.format(totalExpenses)} icon={CreditCard} description="All expenses paid" isLoading={globalIsLoading} />
          <StatCard title="Net Profit" value={currencyFormatter.format(profit)} icon={TrendingUp} description="Revenue minus expenses" isLoading={globalIsLoading} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-lg col-span-1 md:col-span-1">
            <CardHeader>
              <CardTitle>Income vs Expenses</CardTitle>
              <CardDescription>A quick comparison of your financial flow (includes admin data).</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {globalIsLoading ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : chartData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <ChartTooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))' }}
                     />
                    <Legend wrapperStyle={{fontSize: "12px"}}/>
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                 <div className="flex items-center justify-center h-full text-muted-foreground">No financial data yet.</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg col-span-1 md:col-span-1">
            <CardHeader>
              <CardTitle>Upcoming Appointments</CardTitle>
              <CardDescription>Your next few scheduled events (includes admin events).</CardDescription>
            </CardHeader>
            <CardContent>
              {globalIsLoading ? (
                 <div className="flex items-center justify-center h-[250px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : upcomingAppointments.length > 0 ? (
                <ul className="space-y-3">
                  {upcomingAppointments.map(appt => (
                    <li key={appt.id} className="p-3 bg-muted/50 rounded-md hover:bg-muted transition-colors">
                      <div className="font-semibold text-foreground">{appt.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(parseISO(appt.startTime), "EEE, MMM d, yyyy 'at' h:mm a")}
                        {appt.userId !== user?.uid && allUserProfiles?.find(p => p.id === appt.userId)?.role === 'admin' && (
                            <span className="text-xs ml-2">(Admin: {allUserProfiles?.find(p => p.id === appt.userId)?.firstName || 'N/A'})</span>
                        )}
                      </div>
                      {appt.location && <div className="text-xs text-muted-foreground">Location: {appt.location}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">No upcoming appointments.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
