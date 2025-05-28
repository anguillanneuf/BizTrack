'use client';

import React, { useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, CreditCard, TrendingUp, CalendarClock, AlertTriangle, Loader2 } from 'lucide-react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import type { Income, Expense, Appointment } from '@/types';
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

  const incomeQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'incomes'));
  }, [firestore, user]);
  const { data: incomes, isLoading: isLoadingIncomes, error: incomeError } = useCollection<Income>(incomeQuery);

  const expensesQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'expenses'));
  }, [firestore, user]);
  const { data: expenses, isLoading: isLoadingExpenses, error: expenseError } = useCollection<Expense>(expensesQuery);
  
  const appointmentsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    // Get upcoming appointments, sorted by start time, limit to 5
    return query(
        collection(firestore, 'users', user.uid, 'appointments'), 
        orderBy('startTime'),
        limit(5) // You might want to filter for appointments where startTime > now
    );
  }, [firestore, user]);
  const { data: appointments, isLoading: isLoadingAppointments, error: appointmentError } = useCollection<Appointment>(appointmentsQuery);


  const totalIncome = useMemo(() => incomes?.reduce((sum, item) => sum + item.amount, 0) || 0, [incomes]);
  const totalExpenses = useMemo(() => expenses?.reduce((sum, item) => sum + item.amount, 0) || 0, [expenses]);
  const profit = totalIncome - totalExpenses;

  const chartData = useMemo(() => [
    { name: 'Income', value: totalIncome, fill: 'hsl(var(--chart-1))' },
    { name: 'Expenses', value: totalExpenses, fill: 'hsl(var(--chart-2))' },
  ], [totalIncome, totalExpenses]);

  const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  const upcomingAppointments = useMemo(() => {
    if (!appointments) return [];
    const now = new Date();
    return appointments
        .filter(appt => parseISO(appt.startTime) > now) // Filter for future appointments
        .slice(0,3); // Take first 3 upcoming
  }, [appointments]);

  if (incomeError || expenseError || appointmentError) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full text-destructive">
          <AlertTriangle className="w-16 h-16 mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Error loading data</h2>
          <p>Could not load dashboard information. Please try again later.</p>
          {incomeError && <p className="text-sm mt-1">Income Error: {incomeError.message}</p>}
          {expenseError && <p className="text-sm mt-1">Expense Error: {expenseError.message}</p>}
          {appointmentError && <p className="text-sm mt-1">Appointment Error: {appointmentError.message}</p>}
        </div>
      </AppLayout>
    );
  }
  
  const isLoading = isLoadingIncomes || isLoadingExpenses || isLoadingAppointments;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Total Revenue" value={currencyFormatter.format(totalIncome)} icon={DollarSign} description="All income recorded" isLoading={isLoadingIncomes} />
          <StatCard title="Total Expenses" value={currencyFormatter.format(totalExpenses)} icon={CreditCard} description="All expenses paid" isLoading={isLoadingExpenses} />
          <StatCard title="Net Profit" value={currencyFormatter.format(profit)} icon={TrendingUp} description="Revenue minus expenses" isLoading={isLoadingIncomes || isLoadingExpenses} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-lg col-span-1 md:col-span-1">
            <CardHeader>
              <CardTitle>Income vs Expenses</CardTitle>
              <CardDescription>A quick comparison of your financial flow.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {isLoading ? (
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
              <CardDescription>Your next few scheduled events.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAppointments ? (
                 <div className="flex items-center justify-center h-[250px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : upcomingAppointments.length > 0 ? (
                <ul className="space-y-3">
                  {upcomingAppointments.map(appt => (
                    <li key={appt.id} className="p-3 bg-muted/50 rounded-md hover:bg-muted transition-colors">
                      <div className="font-semibold text-foreground">{appt.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(parseISO(appt.startTime), "EEE, MMM d, yyyy 'at' h:mm a")}
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
