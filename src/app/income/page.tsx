
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
import { IncomeFormSchema, type IncomeFormData, type Income } from '@/types';
import { useUser, useFirestore, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { PlusCircle, Edit3, Trash2, Loader2, AlertTriangle, CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function IncomePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);

  const incomeQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'incomes'), orderBy('date', 'desc'));
  }, [firestore, user]);
  const { data: incomes, isLoading: isLoadingIncomes, error: incomesError } = useCollection<Income>(incomeQuery);

  const form = useForm<IncomeFormData>({
    resolver: zodResolver(IncomeFormSchema),
    defaultValues: {
      amount: 0,
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      category: '',
      paymentMethod: '',
      referenceNumber: '',
    },
  });
  
  useEffect(() => {
    if (editingIncome) {
      form.reset({
        ...editingIncome,
        amount: editingIncome.amount,
        date: format(parseISO(editingIncome.date), 'yyyy-MM-dd'),
      });
    } else {
      form.reset({
        amount: 0,
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        category: '',
        paymentMethod: '',
        referenceNumber: '',
      });
    }
  }, [editingIncome, form, isDialogOpen]);

  const onSubmit = (data: IncomeFormData) => {
    if (!user || !firestore) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to manage income." });
      return;
    }

    const incomeData = {
      ...data,
      userId: user.uid,
      amount: Number(data.amount), 
      updatedAt: serverTimestamp(),
    };

    if (editingIncome && editingIncome.id) {
      const docRef = doc(firestore, 'users', user.uid, 'incomes', editingIncome.id);
      updateDocumentNonBlocking(docRef, incomeData);
      toast({ title: 'Income Updated', description: 'Your income record has been updated.' });
    } else {
      const newIncomeData = { ...incomeData, createdAt: serverTimestamp() };
      const collRef = collection(firestore, 'users', user.uid, 'incomes');
      addDocumentNonBlocking(collRef, newIncomeData);
      toast({ title: 'Income Added', description: 'New income record has been added.' });
    }
    setEditingIncome(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (income: Income) => {
     if (!user) {
       toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to edit income." });
       return;
    }
    setEditingIncome(income);
    setIsDialogOpen(true);
  };

  const handleDelete = (incomeItem: Income) => {
    if (!user || !firestore || !incomeItem.id) {
        toast({ variant: "destructive", title: "Error", description: "Could not delete income record." });
        return;
    }
    if (window.confirm('Are you sure you want to delete this income record?')) {
      const docRef = doc(firestore, 'users', user.uid, 'incomes', incomeItem.id);
      deleteDocumentNonBlocking(docRef);
      toast({ title: 'Income Deleted', description: 'Income record has been deleted.' });
    }
  };

  const isLoading = isLoadingIncomes;
  const error = incomesError;

  return (
    <AppLayout>
      <div className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Income Records</CardTitle>
              <CardDescription>Manage your sources of revenue.</CardDescription>
            </div>
            {user && (
              <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingIncome(null); }}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingIncome(null); form.reset(); setIsDialogOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Income
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingIncome ? 'Edit' : 'Add New'} Income</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                      <FormField
                        control={form.control} name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount</FormLabel>
                            <FormControl><Input type="number" placeholder="100.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value))}/></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control} name="date"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>
                                    {field.value ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')} initialFocus/>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="e.g., Project Alpha payment" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category (Optional)</FormLabel><FormControl><Input placeholder="e.g., Client Work" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="paymentMethod" render={({ field }) => (<FormItem><FormLabel>Payment Method (Optional)</FormLabel><FormControl><Input placeholder="e.g., Bank Transfer" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="referenceNumber" render={({ field }) => (<FormItem><FormLabel>Reference Number (Optional)</FormLabel><FormControl><Input placeholder="e.g., INV-123" {...field} /></FormControl><FormMessage /></FormItem>)} />
                      <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                          {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {editingIncome ? 'Save Changes' : 'Add Income'}
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
            {error && (<div className="text-destructive flex flex-col items-center py-10"><AlertTriangle className="w-10 h-10 mb-2"/><p>Error loading income data: {error.message}</p></div>)}
            {!isLoading && !error && incomes && incomes.length === 0 && (<p className="text-center text-muted-foreground py-10">No income records found. Add your first one!</p>)}
            {!isLoading && !error && incomes && incomes.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Category</TableHead>
                    {user && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomes.map((incomeItem) => (
                    <TableRow key={incomeItem.id}>
                      <TableCell>{format(parseISO(incomeItem.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="max-w-xs truncate">{incomeItem.description}</TableCell>
                      <TableCell className="text-right">{currencyFormatter.format(incomeItem.amount)}</TableCell>
                      <TableCell>{incomeItem.category || '-'}</TableCell>
                      {user && (
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(incomeItem)}><Edit3 className="h-4 w-4 text-blue-500" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(incomeItem)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                          </div>
                        </TableCell>
                      )}
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
