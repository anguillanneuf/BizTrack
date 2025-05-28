import { z } from 'zod';

// Schema for user profile data stored in Firestore
export const UserProfileSchema = z.object({
  id: z.string().min(1, "User ID is required."), // Corresponds to Firebase Auth UID
  email: z.string().email("Invalid email address."),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  role: z.enum(['admin', 'employee']).optional(),
  createdAt: z.any().optional(), // Firestore ServerTimestamp
  updatedAt: z.any().optional(), // Firestore ServerTimestamp
});
export type UserProfile = z.infer<typeof UserProfileSchema>;


// Schema for Income
export const IncomeSchema = z.object({
  id: z.string().optional(), // Firestore document ID, optional on create
  userId: z.string().min(1, "User ID is required."),
  amount: z.number().positive("Amount must be positive."),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }), // Expecting "YYYY-MM-DD"
  description: z.string().min(1, "Description is required.").max(200, "Description too long."),
  category: z.string().optional(),
  paymentMethod: z.string().optional(),
  referenceNumber: z.string().optional(),
  createdAt: z.any().optional(), // Firestore ServerTimestamp
  updatedAt: z.any().optional(), // Firestore ServerTimestamp
});
export type Income = z.infer<typeof IncomeSchema>;

// Schema for Expense
export const ExpenseSchema = z.object({
  id: z.string().optional(), // Firestore document ID, optional on create
  userId: z.string().min(1, "User ID is required."),
  amount: z.number().positive("Amount must be positive."),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }), // Expecting "YYYY-MM-DD"
  description: z.string().min(1, "Description is required.").max(200, "Description too long."),
  category: z.string().optional(),
  paymentMethod: z.string().optional(),
  vendor: z.string().optional(),
  referenceNumber: z.string().optional(),
  createdAt: z.any().optional(), // Firestore ServerTimestamp
  updatedAt: z.any().optional(), // Firestore ServerTimestamp
});
export type Expense = z.infer<typeof ExpenseSchema>;

// Schema for Appointment
export const AppointmentSchema = z.object({
  id: z.string().optional(), // Firestore document ID, optional on create
  userId: z.string().min(1, "User ID is required."),
  title: z.string().min(1, "Title is required.").max(100, "Title too long."),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid start time" }), // ISO string
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid end time" }), // ISO string
  location: z.string().optional(),
  description: z.string().optional().max(500, "Description too long."),
  attendees: z.array(z.string()).optional(), // Array of user emails or IDs
  createdAt: z.any().optional(), // Firestore ServerTimestamp
  updatedAt: z.any().optional(), // Firestore ServerTimestamp
}).refine(data => new Date(data.endTime) > new Date(data.startTime), {
  message: "End time must be after start time.",
  path: ["endTime"], // Path to the field that gets the error
});
export type Appointment = z.infer<typeof AppointmentSchema>;

// Schemas for forms (without userId, id, createdAt, updatedAt as these are handled separately)
export const IncomeFormSchema = IncomeSchema.omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export type IncomeFormData = z.infer<typeof IncomeFormSchema>;

export const ExpenseFormSchema = ExpenseSchema.omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export type ExpenseFormData = z.infer<typeof ExpenseFormSchema>;

export const AppointmentFormSchema = AppointmentSchema.omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export type AppointmentFormData = z.infer<typeof AppointmentFormSchema>;

export const CreateUserSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
});
export type CreateUserData = z.infer<typeof CreateUserSchema>;

export const LoginUserSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(1, { message: "Password is required." }),
});
export type LoginUserData = z.infer<typeof LoginUserSchema>;
