
'use client';
import React, { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppointmentFormSchema, type AppointmentFormData, type Appointment } from '@/types';
import { useUser, useFirestore, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { PlusCircle, Edit3, Trash2, Loader2, AlertTriangle, Clock, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, startOfDay, isEqual, setHours, setMinutes } from 'date-fns';

export default function AppointmentsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const appointmentsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users', user.uid, 'appointments'), orderBy('startTime', 'asc'));
  }, [firestore, user]);

  const { data: appointments, isLoading: isLoadingAppointments, error: appointmentsError } = useCollection<Appointment>(appointmentsQuery);

  const appointmentsForSelectedDate = useMemo(() => {
    if (!appointments || !selectedDate) return [];
    return appointments.filter(appt => {
      const apptDate = startOfDay(parseISO(appt.startTime));
      return isEqual(apptDate, startOfDay(selectedDate));
    });
  }, [appointments, selectedDate]);

  const form = useForm<AppointmentFormData>({
    resolver: zodResolver(AppointmentFormSchema),
    defaultValues: {
      title: '',
      startTime: setHours(setMinutes(selectedDate || new Date(), 0), 9).toISOString(),
      endTime: setHours(setMinutes(selectedDate || new Date(), 0), 10).toISOString(),
      location: '',
      description: '',
    },
  });

  useEffect(() => {
    const defaultStartTime = setHours(setMinutes(selectedDate || new Date(), 0), 9);
    const defaultEndTime = setHours(setMinutes(selectedDate || new Date(), 0), 10);

    if (editingAppointment) {
      form.reset({
        ...editingAppointment,
        startTime: editingAppointment.startTime,
        endTime: editingAppointment.endTime,
      });
    } else {
      form.reset({
        title: '',
        startTime: defaultStartTime.toISOString(),
        endTime: defaultEndTime.toISOString(),
        location: '',
        description: '',
      });
    }
  }, [editingAppointment, form, isDialogOpen, selectedDate]);

  const onSubmit = (data: AppointmentFormData) => {
    if (!user || !firestore) {
      toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to manage appointments." });
      return;
    }

    const appointmentData = {
      ...data,
      userId: user.uid,
      updatedAt: serverTimestamp(),
    };

    if (editingAppointment && editingAppointment.id) {
      const docRef = doc(firestore, 'users', user.uid, 'appointments', editingAppointment.id);
      updateDocumentNonBlocking(docRef, appointmentData);
      toast({ title: 'Appointment Updated', description: 'Your appointment has been updated.' });
    } else {
      const newAppointmentData = { ...appointmentData, createdAt: serverTimestamp() };
      const collRef = collection(firestore, 'users', user.uid, 'appointments');
      addDocumentNonBlocking(collRef, newAppointmentData);
      toast({ title: 'Appointment Added', description: 'New appointment has been scheduled.' });
    }
    setEditingAppointment(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (appointment: Appointment) => {
    if (!user) {
        toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to edit appointments." });
        return;
    }
    setEditingAppointment(appointment);
    setIsDialogOpen(true);
  };

  const handleDelete = (appointment: Appointment) => {
    if (!user || !firestore || !appointment.id) {
      toast({ variant: "destructive", title: "Error", description: "Could not delete appointment." });
      return;
    }
    if (window.confirm('Are you sure you want to delete this appointment?')) {
      const docRef = doc(firestore, 'users', user.uid, 'appointments', appointment.id);
      deleteDocumentNonBlocking(docRef);
      toast({ title: 'Appointment Deleted', description: 'Appointment has been deleted.' });
    }
  };
  
  const isLoading = isLoadingAppointments;
  const error = appointmentsError;

  return (
    <AppLayout>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Calendar</CardTitle>
              <CardDescription>Select a date to view appointments.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
                components={{
                  DayContent: ({ date }) => {
                    const dayHasAppointment = appointments?.some(appt => 
                      isEqual(startOfDay(parseISO(appt.startTime)), startOfDay(date))
                    );
                    return (
                      <div className="relative w-full h-full flex items-center justify-center">
                        {format(date, "d")}
                        {dayHasAppointment && (
                          <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                        )}
                      </div>
                    );
                  }
                }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Appointments for {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Today'}</CardTitle>
                <CardDescription>Manage your schedule.</CardDescription>
              </div>
              {user && (
                <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingAppointment(null); }}>
                  <DialogTrigger asChild>
                     <Button onClick={() => { setEditingAppointment(null); form.reset(); setIsDialogOpen(true); }}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Appointment
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{editingAppointment ? 'Edit' : 'New'} Appointment</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                          control={form.control} name="title"
                          render={({ field }) => (
                            <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="Meeting with Client" {...field} /></FormControl><FormMessage /></FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control} name="startTime"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Start Time</FormLabel>
                                <FormControl>
                                  <Input type="datetime-local" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control} name="endTime"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>End Time</FormLabel>
                                <FormControl>
                                  <Input type="datetime-local" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control} name="location"
                          render={({ field }) => (
                            <FormItem><FormLabel>Location (Optional)</FormLabel><FormControl><Input placeholder="Conference Room A" {...field} /></FormControl><FormMessage /></FormItem>
                          )}
                        />
                        <FormField
                          control={form.control} name="description"
                          render={({ field }) => (
                            <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="Discuss project updates..." {...field} /></FormControl><FormMessage /></FormItem>
                          )}
                        />
                        <DialogFooter>
                          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                          <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingAppointment ? 'Save Changes' : 'Add Appointment'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {isLoading && (
                <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              )}
              {error && (
                  <div className="text-destructive flex flex-col items-center py-10"><AlertTriangle className="w-10 h-10 mb-2"/><p>Error loading appointments: {error.message}</p></div>
              )}
              {!isLoading && !error && appointmentsForSelectedDate.length === 0 && (
                <p className="text-center text-muted-foreground py-10">No appointments for this date. Schedule one!</p>
              )}
              {!isLoading && !error && appointmentsForSelectedDate.length > 0 && (
                <ul className="space-y-4">
                  {appointmentsForSelectedDate.map((appt) => (
                    <li key={appt.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-card">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold text-lg text-primary">{appt.title}</h3>
                        {user && (
                          <div className="flex space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(appt)}><Edit3 className="h-4 w-4 text-blue-500" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(appt)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center mt-1">
                        <Clock className="h-4 w-4 mr-2" />
                        {format(parseISO(appt.startTime), 'h:mm a')} - {format(parseISO(appt.endTime), 'h:mm a')}
                      </div>
                      {appt.location && (
                        <div className="text-sm text-muted-foreground flex items-center mt-1">
                          <MapPin className="h-4 w-4 mr-2" />
                          {appt.location}
                        </div>
                      )}
                      {appt.description && <p className="text-sm mt-2 text-foreground/80">{appt.description}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
