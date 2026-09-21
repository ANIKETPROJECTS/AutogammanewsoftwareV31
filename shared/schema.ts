import { z } from "zod";

export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type User = {
  id: string;
  email: string;
  password?: string; // omit in responses
  name?: string;
};

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;

// Dashboard Types
export const statSchema = z.object({
  label: z.string(),
  value: z.string(),
  subtext: z.string(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export type Stat = z.infer<typeof statSchema>;

export const chartDataSchema = z.object({
  name: z.string(),
  value: z.number(),
});

export type ChartData = z.infer<typeof chartDataSchema>;

export const dashboardDataSchema = z.object({
  stats: z.array(statSchema),
  salesTrends: z.array(chartDataSchema),
  customerStatus: z.array(chartDataSchema),
  customerGrowth: z.array(chartDataSchema),
  inventoryByCategory: z.array(chartDataSchema),
  activeJobs: z.array(z.object({
    id: z.string(),
    customerName: z.string(),
    vehicleInfo: z.string(),
    status: z.string(),
  })).default([]),
  upcomingAppointments: z.array(z.object({
    id: z.string(),
    customerName: z.string(),
    vehicleInfo: z.string(),
    date: z.string(),
    time: z.string(),
    serviceType: z.string(),
  })).default([]),
});

export type DashboardData = z.infer<typeof dashboardDataSchema>;

// Service Master Schemas
export const serviceWarrantyOptionSchema = z.object({
  warrantyName: z.string(),
  price: z.coerce.number(),
});

export const vehiclePricingSchema = z.object({
  vehicleType: z.string(),
  price: z.coerce.number(),
  warrantyOptions: z.array(serviceWarrantyOptionSchema).optional().default([]),
});

export const serviceMasterSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  hsnCode: z.string().optional().default(""),
  pricingByVehicleType: z.array(vehiclePricingSchema),
});

export type ServiceWarrantyOption = z.infer<typeof serviceWarrantyOptionSchema>;
export type VehiclePricing = z.infer<typeof vehiclePricingSchema>;
export type ServiceMaster = z.infer<typeof serviceMasterSchema>;

export const insertServiceMasterSchema = serviceMasterSchema.omit({ id: true });
export type InsertServiceMaster = z.infer<typeof insertServiceMasterSchema>;

// PPF Master Schemas
export const ppfPricingOptionSchema = z.object({
  warrantyName: z.string(),
  price: z.coerce.number(),
});

export const ppfVehiclePricingSchema = z.object({
  vehicleType: z.string(),
  options: z.array(ppfPricingOptionSchema),
});

export const ppfRollSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  stock: z.coerce.number(), // sqft
});

export const ppfMasterSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  hsnCode: z.string().optional().default(""),
  pricingByVehicleType: z.array(ppfVehiclePricingSchema),
  rolls: z.array(ppfRollSchema).optional().default([]),
});

export type PPFRoll = z.infer<typeof ppfRollSchema>;
export type PPFPricingOption = z.infer<typeof ppfPricingOptionSchema>;
export type PPFVehiclePricing = z.infer<typeof ppfVehiclePricingSchema>;
export type PPFMaster = z.infer<typeof ppfMasterSchema>;

export const insertPPFMasterSchema = ppfMasterSchema.omit({ id: true });
export type InsertPPFMaster = z.infer<typeof insertPPFMasterSchema>;

export const vehicleTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type VehicleType = z.infer<typeof vehicleTypeSchema>;

// Accessory Master Schemas
export const accessoryCategorySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
});

export type AccessoryCategory = z.infer<typeof accessoryCategorySchema>;

export const accessoryMasterSchema = z.object({
  id: z.string().optional(),
  category: z.string(),
  name: z.string(),
  quantity: z.coerce.number(),
  buffer: z.coerce.number().optional().default(0),
  price: z.coerce.number(),
  hsnCode: z.string().optional().default(""),
  hasDualPricing: z.boolean().optional().default(false),
  price4Window: z.coerce.number().optional().default(0),
  price6Window: z.coerce.number().optional().default(0),
});

export type AccessoryMaster = z.infer<typeof accessoryMasterSchema>;
export const insertAccessoryMasterSchema = accessoryMasterSchema.omit({ id: true });
export type InsertAccessoryMaster = z.infer<typeof insertAccessoryMasterSchema>;

// Expense Schemas
export const expenseSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  details: z.string().optional().default(""),
  price: z.coerce.number().min(0),
  date: z.string(),
  category: z.string().optional().default(""),
  paymentMode: z.string().optional().default(""),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export type Expense = z.infer<typeof expenseSchema>;
export const insertExpenseSchema = expenseSchema.omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

// Technician Schemas
export const technicianSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  specialty: z.string().min(1),
  phone: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  monthlySalary: z.number().optional().default(0),
  joiningDate: z.string().optional().default(""),
});

export type Technician = z.infer<typeof technicianSchema>;
export const insertTechnicianSchema = technicianSchema.omit({ id: true });
export type InsertTechnician = z.infer<typeof insertTechnicianSchema>;

// Employee Loans
export const loanRepaymentSchema = z.object({
  id: z.string(),
  amount: z.number().positive(),
  date: z.string(),
  notes: z.string().optional().default(""),
});

export const loanStatusSchema = z.enum(["active", "overdue", "paid"]);

export const employeeLoanSchema = z.object({
  id: z.string().optional(),
  employeeId: z.string(),
  employeeName: z.string(),
  amount: z.number().positive(),
  monthlyRepayment: z.number().positive(),
  loanDate: z.string(),
  firstRepaymentDate: z.string(),
  notes: z.string().optional().default(""),
  repayments: z.array(loanRepaymentSchema).default([]),
  totalRepaid: z.number().default(0),
  outstandingBalance: z.number().default(0),
  nextPaymentDate: z.string().optional().default(""),
  status: loanStatusSchema.default("active"),
});

export type LoanRepayment = z.infer<typeof loanRepaymentSchema>;
export type EmployeeLoan = z.infer<typeof employeeLoanSchema>;
export const insertEmployeeLoanSchema = employeeLoanSchema.omit({
  id: true,
  employeeName: true,
  repayments: true,
  totalRepaid: true,
  outstandingBalance: true,
  nextPaymentDate: true,
  status: true,
});
export type InsertEmployeeLoan = z.infer<typeof insertEmployeeLoanSchema>;
export const insertLoanRepaymentSchema = loanRepaymentSchema.omit({ id: true });
export type InsertLoanRepayment = z.infer<typeof insertLoanRepaymentSchema>;

// Technician Salary Records
export const salaryPaymentEntrySchema = z.object({
  amount: z.number(),
  date: z.string(),
  method: z.string().default("Cash"),
  notes: z.string().optional().default(""),
});

export const technicianSalaryRecordSchema = z.object({
  id: z.string().optional(),
  technicianId: z.string(),
  month: z.number().min(1).max(12),
  year: z.number().min(2000),
  baseSalary: z.number().default(0),
  salaryDue: z.number().default(0),
  paidAmount: z.number().default(0),
  paymentStatus: z.enum(["paid", "partial", "unpaid"]).default("unpaid"),
  payments: z.array(salaryPaymentEntrySchema).default([]),
  notes: z.string().optional().default(""),
});
export type TechnicianSalaryRecord = z.infer<typeof technicianSalaryRecordSchema>;
export const insertTechnicianSalaryRecordSchema = technicianSalaryRecordSchema.omit({ id: true });
export type InsertTechnicianSalaryRecord = z.infer<typeof insertTechnicianSalaryRecordSchema>;

// Technician Absences
export const technicianAbsenceSchema = z.object({
  id: z.string().optional(),
  technicianId: z.string(),
  date: z.string(),
  reason: z.string().optional().default(""),
});
export type TechnicianAbsence = z.infer<typeof technicianAbsenceSchema>;
export const insertTechnicianAbsenceSchema = technicianAbsenceSchema.omit({ id: true });
export type InsertTechnicianAbsence = z.infer<typeof insertTechnicianAbsenceSchema>;

// Technician Salary Increments
export const technicianIncrementSchema = z.object({
  id: z.string().optional(),
  technicianId: z.string(),
  previousSalary: z.number(),
  newSalary: z.number(),
  effectiveDate: z.string(),
  notes: z.string().optional().default(""),
});
export type TechnicianIncrement = z.infer<typeof technicianIncrementSchema>;
export const insertTechnicianIncrementSchema = technicianIncrementSchema.omit({ id: true });
export type InsertTechnicianIncrement = z.infer<typeof insertTechnicianIncrementSchema>;

export const inquiryPrioritySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type InquiryPriority = z.infer<typeof inquiryPrioritySchema>;

// Appointment Schemas
export const appointmentStatusSchema = z.enum(["SCHEDULED", "DONE", "CANCELLED"]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const appointmentSchema = z.object({
  id: z.string().optional(),
  customerName: z.string().min(1),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  vehicleInfo: z.string().min(1),
  serviceType: z.string().min(1),
  date: z.string(), // ISO string or YYYY-MM-DD
  time: z.string(), // HH:mm
  priority: inquiryPrioritySchema.default("MEDIUM"),
  status: appointmentStatusSchema.default("SCHEDULED"),
  cancelReason: z.string().optional(),
});

export type Appointment = z.infer<typeof appointmentSchema>;
export const insertAppointmentSchema = appointmentSchema.omit({ id: true, status: true, cancelReason: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

// Job Card Schemas
export const jobCardStatusSchema = z.enum(["Pending", "In Progress", "Completed", "Cancelled"]);
export type JobCardStatus = z.infer<typeof jobCardStatusSchema>;
export const gstModeSchema = z.enum(["exclusive", "inclusive"]).default("exclusive");
export type GstMode = z.infer<typeof gstModeSchema>;

export const jobCardItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  technician: z.string().optional(),
  business: z.enum(["Auto Gamma", "AGNX"]).default("Auto Gamma"),
  hsnCode: z.string().optional().default(""),
});

export const ppfRollUsageSchema = z.object({
  rollId: z.string().min(1),
  rollName: z.string().optional().default(""),
  rollUsed: z.coerce.number().min(0).default(0),
});

// HSN Code Master Schemas
export const hsnCodeMasterSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  description: z.string().min(1),
});

export type HsnCodeMaster = z.infer<typeof hsnCodeMasterSchema>;
export const insertHsnCodeMasterSchema = hsnCodeMasterSchema.omit({ id: true });
export type InsertHsnCodeMaster = z.infer<typeof insertHsnCodeMasterSchema>;

export const jobCardSchema = z.object({
  id: z.string().optional(),
  jobNo: z.string(),
  customerName: z.string().min(1),
  phoneNumber: z.string().length(10, "Phone number must be exactly 10 digits").regex(/^\d+$/, "Phone number must contain only digits"),
  emailAddress: z.string().email("Invalid email address").optional().or(z.literal("")),
  gstNumber: z.string().optional().default(""),
  referralSource: z.string(),
  referrerName: z.string().optional(),
  referrerPhone: z.string().optional(),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.string().optional().or(z.literal("")).refine((value) => !value || /^\d{4}$/.test(value), "Year must be a 4-digit number"),
  licensePlate: z.string().min(1).refine((value) => {
    const standard = /^[A-Z]{2}\s\d{2}\s[A-Z]{2}\s\d{4}$/;
    const bharat = /^\d{2}\sBH\s\d{4}\s[A-Z]{2}$/;
    return standard.test(value) || bharat.test(value);
  }, "Format: AA 00 AA 0000 or YY BH 0000 AA"),
  vehicleType: z.string().optional(),
  services: z.array(jobCardItemSchema.extend({ technician: z.string().optional(), warranty: z.string().optional() })).default([]),
  ppfs: z.array(jobCardItemSchema.extend({ 
    technician: z.string().optional(),
    rollId: z.string().optional(),
    rollName: z.string().optional(),
    rollUsed: z.coerce.number().min(0).optional().default(0),
    rollsUsed: z.array(ppfRollUsageSchema).optional().default([]),
    warranty: z.string().optional(),
  })).default([]),
  accessories: z.array(jobCardItemSchema.extend({ quantity: z.number().optional() })).default([]),
  laborCharge: z.number().default(0),
  laborBusiness: z.enum(["Auto Gamma", "AGNX"]).default("Auto Gamma"),
  autoGammaDiscount: z.number().optional().default(0),
  agnxDiscount: z.number().optional().default(0),
  discount: z.number().default(0),
  gst: z.number().default(0),
  gstMode: gstModeSchema,
  serviceNotes: z.string().optional(),
  status: jobCardStatusSchema.default("Pending"),
  date: z.string().default(() => new Date().toISOString()),
  estimatedCost: z.number(),
  technician: z.string().optional(),
});

export type JobCard = z.infer<typeof jobCardSchema>;
export const insertJobCardSchema = jobCardSchema.omit({ id: true, jobNo: true, date: true });
export type InsertJobCard = z.infer<typeof insertJobCardSchema>;

// Invoice Schemas
export const invoiceItemSchema = z.object({
  name: z.string(),
  price: z.number(),
  quantity: z.number().optional().default(1),
  type: z.enum(["Service", "PPF", "Accessory", "Labor"]),
  category: z.string().optional(),
  warranty: z.string().optional(),
  vehicleType: z.string().optional(),
  rollUsed: z.number().optional(),
  technician: z.string().optional(),
  hsnCode: z.string().optional(),
});

export type InvoiceItem = z.infer<typeof invoiceItemSchema>;

export const paymentEntrySchema = z.object({
  amount: z.coerce.number(),
  method: z.string(),
  date: z.string(),
});

export type PaymentEntry = z.infer<typeof paymentEntrySchema>;

export const invoiceSchema = z.object({
  id: z.string().optional(),
  invoiceNo: z.string(),
  jobCardId: z.string(),
  business: z.enum(["Auto Gamma", "AGNX"]),
  customerName: z.string(),
  phoneNumber: z.string(),
  emailAddress: z.string().optional(),
  customerGstNumber: z.string().optional().default(""),
  vehicleInfo: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleYear: z.string().optional(),
  licensePlate: z.string().optional(),
  vehicleType: z.string().optional(),
  items: z.array(invoiceItemSchema),
  subtotal: z.number(),
  discount: z.number().optional().default(0),
  laborCharge: z.number().optional().default(0),
  gstPercentage: z.number().optional().default(0),
  gstMode: gstModeSchema,
  gstAmount: z.number(),
  totalAmount: z.number(),
  date: z.string(),
  isPaid: z.boolean().default(false),
  payments: z.array(paymentEntrySchema).default([]),
});

export type Invoice = z.infer<typeof invoiceSchema>;

// Ticket Schemas
export const ticketSchema = z.object({
  id: z.string().optional(),
  customerId: z.string().default(""),
  customerName: z.string().min(1),
  phone: z.string().default(""),
  note: z.string().min(1),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export type Ticket = z.infer<typeof ticketSchema>;
export const insertTicketSchema = ticketSchema.omit({ id: true, createdAt: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;

export const inquiryStatusSchema = z.enum(["NEW", "FOLLOW_UP", "CONVERTED", "LOST"]);
export type InquiryStatus = z.infer<typeof inquiryStatusSchema>;

export const inquiryItemSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  vehicleType: z.string().optional(),
  warrantyName: z.string().optional(),
  price: z.number(),
  customerPrice: z.number().optional(),
});

export const inquiryAccessorySchema = z.object({
  accessoryId: z.string(),
  accessoryName: z.string(),
  category: z.string(),
  price: z.number(),
  customerPrice: z.number().optional(),
});

export const inquirySchema = z.object({
  id: z.string().optional(),
  inquiryId: z.string().optional(),
  customerName: z.string().min(1),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  services: z.array(inquiryItemSchema).default([]),
  accessories: z.array(inquiryAccessorySchema).default([]),
  notes: z.string().optional(),
  ourPrice: z.number().default(0),
  customerPrice: z.number().default(0),
  status: inquiryStatusSchema.default("NEW"),
  priority: inquiryPrioritySchema.default("MEDIUM"),
  isConverted: z.boolean().default(false),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export type Inquiry = z.infer<typeof inquirySchema>;
export const insertInquirySchema = inquirySchema.omit({ id: true, inquiryId: true, status: true, createdAt: true });
export type InsertInquiry = z.infer<typeof insertInquirySchema>;

// Old Customer Schemas
export const oldCustomerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  number: z.string().min(10, "Number must be at least 10 digits"),
  vehicleNumber: z.string().min(1, "Vehicle number is required"),
  notes: z.string().optional().default("NA"),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export type OldCustomer = z.infer<typeof oldCustomerSchema>;
export const insertOldCustomerSchema = oldCustomerSchema.omit({ id: true, createdAt: true });
export type InsertOldCustomer = z.infer<typeof insertOldCustomerSchema>;

// Vendor Management Schemas
export const vendorSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  contactPerson: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().optional().default(""),
  address: z.string().optional().default(""),
  category: z.string().optional().default(""),
  categories: z.array(z.string()).optional().default([]),
  notes: z.string().optional().default(""),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export type Vendor = z.infer<typeof vendorSchema>;
export const insertVendorSchema = vendorSchema.omit({ id: true, createdAt: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;

export const purchaseItemSchema = z.object({
  itemType: z.enum(["PPF", "Accessory"]).default("PPF"),
  categoryName: z.string().optional().default(""),
  name: z.string().min(1),
  rollName: z.string().optional().default(""),
  ppfPricing: z.array(z.any()).optional().default([]),
  hsnCode: z.string().optional().default(""),
  quantity: z.coerce.number().min(0),
  unit: z.string().default("pcs"),
  unitPrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0).default(0),
});

export type PurchaseItem = z.infer<typeof purchaseItemSchema>;

export const paymentRecordSchema = z.object({
  method: z.string().default(""),
  date: z.string().default(""),
  amount: z.coerce.number().min(0).default(0),
});

export type PaymentRecord = z.infer<typeof paymentRecordSchema>;

export const vendorPurchaseSchema = z.object({
  id: z.string().optional(),
  vendorId: z.string().min(1),
  vendorName: z.string().optional().default(""),
  items: z.array(purchaseItemSchema).default([]),
  totalAmount: z.coerce.number().default(0),
  sellingTotal: z.coerce.number().default(0),
  purchaseDate: z.string().default(() => new Date().toISOString().split("T")[0]),
  receivedDate: z.string().optional().default(""),
  status: z.enum(["ordered", "received", "partial"]).default("ordered"),
  paymentStatus: z.enum(["paid", "partially_paid", "unpaid"]).default("unpaid"),
  payments: z.array(paymentRecordSchema).default([]),
  notes: z.string().optional().default(""),
  gstEnabled: z.boolean().optional().default(false),
  gstType: z.enum(["none", "external", "internal"]).optional().default("none"),
  cgstPercent: z.coerce.number().optional().default(0),
  sgstPercent: z.coerce.number().optional().default(0),
  cgstAmount: z.coerce.number().optional().default(0),
  sgstAmount: z.coerce.number().optional().default(0),
  grandTotal: z.coerce.number().optional().default(0),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export type VendorPurchase = z.infer<typeof vendorPurchaseSchema>;
export const insertVendorPurchaseSchema = vendorPurchaseSchema.omit({ id: true, createdAt: true });
export type InsertVendorPurchase = z.infer<typeof insertVendorPurchaseSchema>;

// Warranty Follow-up Schemas
export const warrantyFollowUpSchema = z.object({
  id: z.string().optional(),
  invoiceId: z.string().optional().default(""),
  jobCardId: z.string().default(""),
  jobNo: z.string().default(""),
  customerName: z.string(),
  customerPhone: z.string(),
  vehicleInfo: z.string(),
  licensePlate: z.string().optional().default(""),
  serviceName: z.string(),
  serviceType: z.enum(["Service", "PPF"]),
  warrantyPeriod: z.string(),
  serviceDate: z.string(),
  checkupStatus: z.enum(["pending", "done"]).default("pending"),
  checkupDate: z.string().optional().default(""),
  checkupNotes: z.string().optional().default(""),
  topupStatus: z.enum(["pending", "done", "not_applicable"]).default("pending"),
  topupDate: z.string().optional().default(""),
  topupNotes: z.string().optional().default(""),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export type WarrantyFollowUp = z.infer<typeof warrantyFollowUpSchema>;
export const insertWarrantyFollowUpSchema = warrantyFollowUpSchema.omit({ id: true, createdAt: true });
export type InsertWarrantyFollowUp = z.infer<typeof insertWarrantyFollowUpSchema>;

// Resell Order Schemas
export const resellOrderSchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  buyerName: z.string().min(1, "Buyer name is required"),
  buyerPhone: z.string().optional().default(""),
  buyerGstin: z.string().optional().default(""),
  itemType: z.enum(["Accessory", "PPF"]),
  // Accessory fields
  accessoryId: z.string().optional().default(""),
  accessoryName: z.string().optional().default(""),
  accessoryCategory: z.string().optional().default(""),
  quantity: z.coerce.number().optional().default(0),
  // PPF fields
  ppfBrandId: z.string().optional().default(""),
  ppfBrandName: z.string().optional().default(""),
  ppfRollId: z.string().optional().default(""),
  ppfRollName: z.string().optional().default(""),
  sqft: z.coerce.number().optional().default(0),
  // Pricing
  unitPrice: z.coerce.number().min(0),
  totalAmount: z.coerce.number().min(0),
  // GST
  gstType: z.enum(["None", "Internal", "External"]).optional().default("None"),
  gstPercentage: z.coerce.number().optional().default(0),
  cgstPercentage: z.coerce.number().optional().default(0),
  sgstPercentage: z.coerce.number().optional().default(0),
  igstPercentage: z.coerce.number().optional().default(0),
  gstAmount: z.coerce.number().optional().default(0),
  grandTotal: z.coerce.number().optional().default(0),
  hsnCode: z.string().optional().default(""),
  invoiceNo: z.string().optional().default(""),
  paymentMode: z.string().default("Cash"),
  notes: z.string().optional().default(""),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export type ResellOrder = z.infer<typeof resellOrderSchema>;
export const insertResellOrderSchema = resellOrderSchema.omit({ id: true, createdAt: true });
export type InsertResellOrder = z.infer<typeof insertResellOrderSchema>;

// ── WhatsApp Inquiries ───────────────────────────────────────────────────────

export const WHATSAPP_INQUIRY_STAGES = [
  "NEW",
  "FORM_SUBMITTED",
  "FOLLOW_UP_REQUIRED",
  "BOOKING_CONFIRMED",
  "BOOKING_CANCELLED",
  "COMPLETED",
  "LOST",
] as const;

export type WhatsAppInquiryStage = (typeof WHATSAPP_INQUIRY_STAGES)[number];

export const whatsappInquirySchema = z.object({
  id: z.string().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  phone: z.string().min(1, "Phone number is required"),
  whatsappContactName: z.string().default(""),
  vehicleModel: z.string().default(""),
  vehicleCategory: z.string().default(""),
  serviceName: z.string().default(""),
  quotedPrice: z.coerce.number().default(0),
  currency: z.string().default("INR"),
  appointmentDate: z.string().default(""),
  appointmentTime: z.string().default(""),
  timezone: z.string().default("Asia/Kolkata"),
  notes: z.string().default(""),
  stage: z.enum(WHATSAPP_INQUIRY_STAGES).default("NEW"),
  bookingId: z.string().default(""),
  assignedTo: z.string().default(""),
  airavataContactId: z.string().optional(),
  airavataConversationId: z.string().optional(),
  externalInquiryId: z.string().optional(),
  sourceSystem: z.string().optional(),
  externalEventId: z.string().optional(),
  source: z.string().default("whatsapp"),
  formSubmittedAt: z.string().optional(),
  confirmedAt: z.string().optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export type WhatsAppInquiry = z.infer<typeof whatsappInquirySchema>;
export const insertWhatsAppInquirySchema = whatsappInquirySchema.omit({ id: true, createdAt: true });
export type InsertWhatsAppInquiry = z.infer<typeof insertWhatsAppInquirySchema>;
