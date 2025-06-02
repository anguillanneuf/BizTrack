
'use client';
import React, { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExpenseFormSchema, type ExpenseFormData, type Expense, type UserProfile } from '@/types';
import { useUser, useFirestore, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, useDoc, type WithId } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc, onSnapshot } from 'firebase/firestore';
import { PlusCircle, Edit3, Trash2, Loader2, AlertTriangle, CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function ExpensesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const currentUserProfileRef = useMemo(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: currentUserProfile, isLoading: isLoadingCurrentUserProfile } = useDoc<UserProfile>(currentUserProfileRef);
  const isCurrentUserAdmin = useMemo(() => currentUserProfile?.role === 'admin', [currentUserProfile]);

  const allUsersQuery = useMemo(() => firestore ? query(collection(firestore, 'users')) : null, [firestore]);
  const { data: allUserProfiles, isLoading: isLoadingAllUserProfiles, error: allUserProfilesError } = useCollection<UserProfile>(allUsersQuery);

  const adminUids = useMemo(() => {
    if (!allUserProfiles) return [];
    return allUserProfiles.filter(p => p.role === 'admin').map(p => p.id);
  }, [allUserProfiles]);

  const currentUserExpensesQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'expenses'), orderBy('date', 'desc'));
  }, [firestore, user]);
  const { data: currentUserExpenses, isLoading: isLoadingCurrentUserExpenses, error: currentUserExpensesError } = useCollection<Expense>(currentUserExpensesQuery);

  const [adminExpensesData, setAdminExpensesData] = useState<Record<string, WithId<Expense>[]>>({});
  const [isLoadingAdminExpenses, setIsLoadingAdminExpenses] = useState(false);
  const [adminExpensesError, setAdminExpensesError] = useState<Error | null>(null);

  useEffect(() => {
    if (!firestore || adminUids.length === 0 || !user) {
      setAdminExpensesData({});
      setIsLoadingAdminExpenses(false);
      return;
    }

    setIsLoadingAdminExpenses(true);
    setAdminExpensesError(null);
    const unsubscribers: (() => void)[] = [];
    let activeFetches = 0;

    const uidsToFetch = adminUids.filter(uid => uid !== user.uid);
    if (uidsToFetch.length === 0) {
      setIsLoadingAdminExpenses(false);
      setAdminExpensesData({});
      return;
    }
    activeFetches = uidsToFetch.length;

    uidsToFetch.forEach(adminUid => {
      const q = query(collection(firestore, 'users', adminUid, 'expenses'), orderBy('date', 'desc'));
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const items = snapshot.docs.map(doc => ({ ...doc.data() as Expense, id: doc.id }));
          setAdminExpensesData(prev => ({ ...prev, [adminUid]: items }));
          activeFetches--;
          if (activeFetches === 0) setIsLoadingAdminExpenses(false);
        }, 
        (err) => {
          console.error(`Error fetching expenses for admin ${adminUid}:`, err);
          setAdminExpensesError(err);
          activeFetches--;
          if (activeFetches === 0) setIsLoadingAdminExpenses(false);
        }
      );
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [firestore, adminUids, user]);

  const allExpenses = useMemo(() => {
    let combined: WithId<Expense>[] = [];
    if (currentUserExpenses) {
      combined = [...currentUserExpenses];
    }
    Object.values(adminExpensesData).forEach(adminList => {
      combined.push(...adminList);
    });
    
    const uniqueMap = new Map<string, WithId<Expense>>();
    combined.forEach(item => uniqueMap.set(item.id, item));
    
    return Array.from(uniqueMap.values()).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
  }, [currentUserExpenses, adminExpensesData]);

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(ExpenseFormSchema),
    defaultValues: {
      amount: 0,
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      category: '',
      paymentMethod: '',
      vendor: '',
      referenceNumber: '',
    },
  });

  useEffect(() => {
    if (editingExpense) {
      form.reset({
        ...editingExpense,
        amount: editingExpense.amount,
        date: format(parseISO(editingExpense.date), 'yyyy-MM-dd'),
      });
    } else {
      form.reset({
        amount: 0,
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        category: '',
        paymentMethod: '',
        vendor: '',
        referenceNumber: '',
      });
    }
  }, [editingExpense, form, isDialogOpen]);

  const onSubmit = (data: ExpenseFormData) => {
    if (!user || !firestore || !isCurrentUserAdmin) return;

    const expenseData = {
      ...data,
      userId: user.uid,
      amount: Number(data.amount),
      updatedAt: serverTimestamp(),
    };

    if (editingExpense && editingExpense.id) {
      if (editingExpense.userId !== user.uid) {
         toast({ variant: "destructive", title: "Permission Denied", description: "You can only edit your own expense records." });
         return;
      }
      const docRef = doc(firestore, 'users', user.uid, 'expenses', editingExpense.id);
      updateDocumentNonBlocking(docRef, expenseData);
      toast({ title: 'Expense Updated', description: 'Your expense record has been updated.' });
    } else {
      const newExpenseData = { ...expenseData, createdAt: serverTimestamp() };
      const collRef = collection(firestore, 'users', user.uid, 'expenses');
      addDocumentNonBlocking(collRef, newExpenseData);
      toast({ title: 'Expense Added', description: 'New expense record has been added.' });
    }
    setEditingExpense(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (expense: Expense) => {
    if (!isCurrentUserAdmin || expense.userId !== user?.uid) {
      toast({ variant: "destructive", title: "Permission Denied", description: "You can only edit expense records you created." });
      return;
    }
    setEditingExpense(expense);
    setIsDialogOpen(true);
  };

  const handleDelete = (expenseItem: Expense) => {
    if (!user || !firestore || !expenseItem.id || !isCurrentUserAdmin || expenseItem.userId !== user?.uid) {
      toast({ variant: "destructive", title: "Permission Denied", description: "You can only delete expense records you created." });
      return;
    }
    if (window.confirm('Are you sure you want to delete this expense record?')) {
      const docRef = doc(firestore, 'users', user.uid, 'expenses', expenseItem.id);
      deleteDocumentNonBlocking(docRef);
      toast({ title: 'Expense Deleted', description: 'Expense record has been deleted.' });
    }
  };
  
  const isLoading = isLoadingCurrentUserProfile || isLoadingAllUserProfiles || isLoadingCurrentUserExpenses || isLoadingAdminExpenses;
  const error = currentUserExpensesError || adminExpensesError || allUserProfilesError;

  return (
    <AppLayout>
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Expense Records</CardTitle>
              <CardDescription>Track your business expenditures. {isCurrentUserAdmin ? '' : 'Viewing combined records.'}</CardDescription>
            </div>
            {!isLoadingCurrentUserProfile && isCurrentUserAdmin && (
              <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingExpense(null); }}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingExpense(null); form.reset(); setIsDialogOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Expense
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingExpense ? 'Edit' : 'Add New'} Expense</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                      <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" placeholder="50.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value))}/></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="date" render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Date</FormLabel>
                             <Popover>
                              <PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>
                                    {field.value ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')} initialFocus/></PopoverContent>
                            </Popover><FormMessage />
                          </FormItem>)} />
                      <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="e.g., Office supplies" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category (Optional)</FormLabel><FormControl><Input placeholder="e.g., Utilities" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="vendor" render={({ field }) => (<FormItem><FormLabel>Vendor (Optional)</FormLabel><FormControl><Input placeholder="e.g., Local Power Co." {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="paymentMethod" render={({ field }) => (<FormItem><FormLabel>Payment Method (Optional)</FormLabel><FormControl><Input placeholder="e.g., Credit Card" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="referenceNumber" render={({ field }) => (<FormItem><FormLabel>Reference Number (Optional)</FormLabel><FormControl><Input placeholder="e.g., Bill #456" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                          {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {editingExpense ? 'Save Changes' : 'Add Expense'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
             {isLoading && (<div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>)}
            {error && (<div className="text-destructive flex flex-col items-center py-10"><AlertTriangle className="w-10 h-10 mb-2"/><p>Error loading expense data: {error.message}</p></div>)}
            {!isLoading && !error && allExpenses && allExpenses.length === 0 && (<p className="text-center text-muted-foreground py-10">No expense records found. {isCurrentUserAdmin ? 'Add your first one!' : ''}</p>)}
            {!isLoading && !error && allExpenses && allExpenses.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Category</TableHead>
                    {isCurrentUserAdmin && <TableHead>Added By</TableHead>}
                    {isCurrentUserAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allExpenses.map((expenseItem) => (
                    <TableRow key={expenseItem.id}>
                      <TableCell>{format(parseISO(expenseItem.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="max-w-xs truncate">{expenseItem.description}</TableCell>
                      <TableCell className="text-right">{currencyFormatter.format(expenseItem.amount)}</TableCell>
                      <TableCell>{expenseItem.category || '-'}</TableCell>
                      {isCurrentUserAdmin && (
                        <TableCell>
                          {expenseItem.userId === user?.uid ? 'You' : (allUserProfiles?.find(p => p.id === expenseItem.userId)?.firstName || 'Admin')}
                        </TableCell>
                      )}
                      {!isLoadingCurrentUserProfile && isCurrentUserAdmin && expenseItem.userId === user?.uid && (
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(expenseItem)}><Edit3 className="h-4 w-4 text-blue-500" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(expenseItem)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                          </div>
                        </TableCell>
                      )}
                      {!isLoadingCurrentUserProfile && isCurrentUserAdmin && expenseItem.userId !== user?.uid && (<TableCell></TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
