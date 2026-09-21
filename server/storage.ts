import mongoose from "mongoose";
import crypto from "node:crypto";
import { 
  User, 
  InsertUser, 
  DashboardData, 
  ServiceMaster, 
  InsertServiceMaster, 
  PPFMaster,
  InsertPPFMaster,
  AccessoryMaster,
  InsertAccessoryMaster,
  AccessoryCategory,
  VehicleType,
  Technician,
  InsertTechnician,
  Appointment,
  InsertAppointment,
  JobCard,
  InsertJobCard,
  Inquiry,
  InsertInquiry,
  Invoice,
  Vendor,
  InsertVendor,
  VendorPurchase,
  InsertVendorPurchase,
  Expense,
  InsertExpense,
  WarrantyFollowUp,
  InsertWarrantyFollowUp,
  TechnicianSalaryRecord,
  InsertTechnicianSalaryRecord,
  TechnicianAbsence,
  InsertTechnicianAbsence,
  TechnicianIncrement,
  InsertTechnicianIncrement,
  EmployeeLoan,
  InsertEmployeeLoan,
  InsertLoanRepayment,
  ResellOrder,
  InsertResellOrder,
} from "@shared/schema";
import { calculateGstAmounts } from "@shared/gst";
import session from "express-session";
// @ts-ignore
import MongoStore from "connect-mongodb-session";

const MongoDBStore = MongoStore(session);

// Mongoose Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String },
});

export const UserModel = mongoose.model("User", userSchema);

const serviceMasterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  hsnCode: { type: String, default: "" },
  pricingByVehicleType: [{
    vehicleType: String,
    price: Number,
    warrantyOptions: [{
      warrantyName: String,
      price: Number
    }]
  }]
});

export const ServiceMasterModel = mongoose.model("ServiceMaster", serviceMasterSchema);

const ppfMasterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  hsnCode: { type: String, default: "" },
  pricingByVehicleType: [{
    vehicleType: String,
    options: [{
      warrantyName: String,
      price: Number
    }]
  }],
  rolls: [{
    name: String,
    stock: Number
  }]
});

export const PPFMasterModel = mongoose.model("PPFMaster", ppfMasterSchema);

const vehicleTypeSchema = new mongoose.Schema({
  name: { type: String, required: true }
});

export const VehicleTypeModel = mongoose.model("VehicleType", vehicleTypeSchema);

const accessoryCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});

export const AccessoryCategoryModel = mongoose.model("AccessoryCategory", accessoryCategorySchema);

const accessoryMasterSchema = new mongoose.Schema({
  category: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  buffer: { type: Number, default: 0 },
  price: { type: Number, required: true },
  hsnCode: { type: String, default: "" },
  hasDualPricing: { type: Boolean, default: false },
  price4Window: { type: Number, default: 0 },
  price6Window: { type: Number, default: 0 },
});

export const AccessoryMasterModel = mongoose.model("AccessoryMaster", accessoryMasterSchema);

function applyAccessoryInventoryDelta(
  currentQuantity: number,
  currentBuffer: number,
  delta: number,
) {
  const quantity = Math.max(0, Number(currentQuantity) || 0);
  const buffer = Math.max(0, Number(currentBuffer) || 0);
  const change = Number(delta) || 0;

  if (change > 0) {
    const quantityUsed = Math.min(quantity, change);
    return {
      quantity: quantity - quantityUsed,
      buffer: buffer + (change - quantityUsed),
    };
  }

  const returnedQuantity = Math.abs(change);
  const bufferReleased = Math.min(buffer, returnedQuantity);
  return {
    quantity: quantity + (returnedQuantity - bufferReleased),
    buffer: buffer - bufferReleased,
  };
}

function applyAccessoryStockReceipt(
  currentQuantity: number,
  currentBuffer: number,
  receivedQuantity: number,
) {
  const quantity = Math.max(0, Number(currentQuantity) || 0);
  const buffer = Math.max(0, Number(currentBuffer) || 0);
  const received = Number(receivedQuantity) || 0;

  if (received >= 0) {
    const bufferConsumed = Math.min(buffer, received);
    return {
      quantity: quantity + (received - bufferConsumed),
      buffer: buffer - bufferConsumed,
    };
  }

  const receiptToReverse = Math.abs(received);
  const quantityRemoved = Math.min(quantity, receiptToReverse);
  return {
    quantity: quantity - quantityRemoved,
    buffer: buffer + (receiptToReverse - quantityRemoved),
  };
}

const resellOrderMongoSchema = new mongoose.Schema({
  date: { type: String, required: true },
  buyerName: { type: String, required: true },
  buyerPhone: { type: String, default: "" },
  buyerGstin: { type: String, default: "" },
  itemType: { type: String, required: true },
  accessoryId: { type: String, default: "" },
  accessoryName: { type: String, default: "" },
  accessoryCategory: { type: String, default: "" },
  quantity: { type: Number, default: 0 },
  ppfBrandId: { type: String, default: "" },
  ppfBrandName: { type: String, default: "" },
  ppfRollId: { type: String, default: "" },
  ppfRollName: { type: String, default: "" },
  sqft: { type: Number, default: 0 },
  unitPrice: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  gstType: { type: String, default: "None" },
  gstPercentage: { type: Number, default: 0 },
  cgstPercentage: { type: Number, default: 0 },
  sgstPercentage: { type: Number, default: 0 },
  igstPercentage: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  hsnCode: { type: String, default: "" },
  invoiceNo: { type: String, default: "" },
  paymentMode: { type: String, default: "Cash" },
  notes: { type: String, default: "" },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

export const ResellOrderModel = mongoose.model("ResellOrder", resellOrderMongoSchema);

// ── WhatsApp Inquiries ───────────────────────────────────────────────────────
const whatsappInquiryMongoSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  whatsappContactName: { type: String, default: "" },
  vehicleModel: { type: String, default: "" },
  vehicleCategory: { type: String, default: "" },
  serviceName: { type: String, default: "" },
  quotedPrice: { type: Number, default: 0 },
  currency: { type: String, default: "INR" },
  appointmentDate: { type: String, default: "" },
  appointmentTime: { type: String, default: "" },
  timezone: { type: String, default: "Asia/Kolkata" },
  notes: { type: String, default: "" },
  stage: {
    type: String,
    enum: ["NEW", "FORM_SUBMITTED", "FOLLOW_UP_REQUIRED", "BOOKING_CONFIRMED", "BOOKING_CANCELLED", "COMPLETED", "LOST"],
    default: "NEW",
  },
  bookingId: { type: String, default: "" },
  assignedTo: { type: String, default: "" },
  airavataContactId: { type: String },
  airavataConversationId: { type: String },
  externalInquiryId: { type: String },
  sourceSystem: { type: String },
  externalEventId: { type: String },
  source: { type: String, default: "whatsapp" },
  formSubmittedAt: { type: String },
  confirmedAt: { type: String },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

// External inquiry IDs are unique within their source system. Event IDs are
// separately unique within a source system for webhook idempotency.
whatsappInquiryMongoSchema.index(
  { sourceSystem: 1, externalInquiryId: 1 },
  { unique: true, sparse: true, name: "whatsapp_inquiry_external_identity" },
);
whatsappInquiryMongoSchema.index(
  { sourceSystem: 1, externalEventId: 1 },
  { unique: true, sparse: true, name: "whatsapp_inquiry_external_event" },
);

export const WhatsAppInquiryModel = mongoose.model("WhatsAppInquiry", whatsappInquiryMongoSchema);

const airavataIntegrationEventSchema = new mongoose.Schema({
  sourceSystem: { type: String, required: true },
  externalEventId: { type: String, required: true },
  externalInquiryId: { type: String, required: true },
  inquiryId: { type: String, default: "" },
  stage: { type: String, default: "NEW" },
  status: { type: String, enum: ["PROCESSING", "COMPLETED"], default: "PROCESSING" },
  occurredAt: { type: String, default: "" },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

airavataIntegrationEventSchema.index(
  { sourceSystem: 1, externalEventId: 1 },
  { unique: true, name: "airavata_integration_event_identity" },
);

export const AiravataIntegrationEventModel = mongoose.model(
  "AiravataIntegrationEvent",
  airavataIntegrationEventSchema,
);

const expenseMongoSchema = new mongoose.Schema({
  name: { type: String, required: true },
  details: { type: String, default: "" },
  price: { type: Number, required: true },
  date: { type: String, required: true },
  category: { type: String, default: "" },
  paymentMode: { type: String, default: "" },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

export const ExpenseModel = mongoose.model("Expense", expenseMongoSchema);

const warrantyFollowUpMongoSchema = new mongoose.Schema({
  invoiceId: { type: String, default: "" },
  jobCardId: { type: String, default: "" },
  jobNo: { type: String, default: "" },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  vehicleInfo: { type: String, required: true },
  licensePlate: { type: String, default: "" },
  serviceName: { type: String, required: true },
  serviceType: { type: String, enum: ["Service", "PPF"], required: true },
  warrantyPeriod: { type: String, required: true },
  serviceDate: { type: String, required: true },
  checkupStatus: { type: String, enum: ["pending", "done"], default: "pending" },
  checkupDate: { type: String, default: "" },
  checkupNotes: { type: String, default: "" },
  topupStatus: { type: String, enum: ["pending", "done", "not_applicable"], default: "pending" },
  topupDate: { type: String, default: "" },
  topupNotes: { type: String, default: "" },
  createdAt: { type: String, default: () => new Date().toISOString() },
});

export const WarrantyFollowUpModel = mongoose.model("WarrantyFollowUp", warrantyFollowUpMongoSchema);

const technicianMongoSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialty: { type: String, required: true },
  phone: { type: String },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  monthlySalary: { type: Number, default: 0 },
  joiningDate: { type: String, default: "" },
});

export const TechnicianModel = mongoose.model("Technician", technicianMongoSchema);

const technicianSalaryRecordMongoSchema = new mongoose.Schema({
  technicianId: { type: String, required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  baseSalary: { type: Number, default: 0 },
  salaryDue: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ["paid", "partial", "unpaid"], default: "unpaid" },
  payments: [{ amount: Number, date: String, method: String, notes: String }],
  notes: { type: String, default: "" },
});
export const TechnicianSalaryRecordModel = mongoose.model("TechnicianSalaryRecord", technicianSalaryRecordMongoSchema);

const technicianAbsenceMongoSchema = new mongoose.Schema({
  technicianId: { type: String, required: true },
  date: { type: String, required: true },
  reason: { type: String, default: "" },
});
export const TechnicianAbsenceModel = mongoose.model("TechnicianAbsence", technicianAbsenceMongoSchema);

const technicianIncrementMongoSchema = new mongoose.Schema({
  technicianId: { type: String, required: true },
  previousSalary: { type: Number, required: true },
  newSalary: { type: Number, required: true },
  effectiveDate: { type: String, required: true },
  notes: { type: String, default: "" },
});
export const TechnicianIncrementModel = mongoose.model("TechnicianIncrement", technicianIncrementMongoSchema);

const employeeLoanMongoSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  employeeName: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  monthlyRepayment: { type: Number, required: true, min: 0 },
  loanDate: { type: String, required: true },
  firstRepaymentDate: { type: String, required: true },
  notes: { type: String, default: "" },
  repayments: [{
    id: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: String, required: true },
    notes: { type: String, default: "" },
  }],
});
export const EmployeeLoanModel = mongoose.model("EmployeeLoan", employeeLoanMongoSchema);

const appointmentSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  vehicleInfo: { type: String, required: true },
  serviceType: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  priority: { type: String, enum: ["HIGH", "MEDIUM", "LOW"], default: "MEDIUM" },
  status: { type: String, enum: ["SCHEDULED", "DONE", "CANCELLED"], default: "SCHEDULED" },
  cancelReason: { type: String },
});

export const AppointmentModel = mongoose.model("Appointment", appointmentSchema);

const inquiryMongoSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  services: [{
    serviceId: String,
    serviceName: String,
    vehicleType: String,
    warrantyName: String,
    price: Number,
    customerPrice: Number
  }],
  accessories: [{
    accessoryId: String,
    accessoryName: String,
    category: String,
    price: Number,
    customerPrice: Number
  }],
  notes: { type: String },
  ourPrice: { type: Number, default: 0 },
  customerPrice: { type: Number, default: 0 },
  status: { type: String, enum: ["NEW", "FOLLOW_UP", "CONVERTED", "LOST"], default: "NEW" },
  priority: { type: String, enum: ["HIGH", "MEDIUM", "LOW"], default: "MEDIUM" },
  date: { type: String, required: true },
  inquiryId: { type: String, required: true },
  isConverted: { type: Boolean, default: false },
  createdAt: { type: String }
});

export const InquiryModel = mongoose.model("Inquiry", inquiryMongoSchema);

const hsnCodeMongoSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  description: { type: String, required: true },
});

export const HsnCodeModel = mongoose.model("HsnCode", hsnCodeMongoSchema);

const jobCardMongoSchema = new mongoose.Schema({
  jobNo: { type: String, required: true, unique: true },
  customerName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  emailAddress: { type: String },
  referralSource: { type: String },
  referrerName: { type: String },
  referrerPhone: { type: String },
  make: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: String },
  licensePlate: { type: String, required: true },
  vin: { type: String },
  services: [{ id: String, serviceId: String, name: String, price: Number, technician: String, warranty: { type: String, default: "" }, business: { type: String, default: "Auto Gamma" }, hsnCode: { type: String, default: "" } }],
  ppfs: [{ id: String, ppfId: String, name: String, price: Number, technician: String, rollId: String, rollName: String, rollUsed: Number, rollsUsed: [{ rollId: String, rollName: String, rollUsed: Number }], warranty: String, business: { type: String, default: "Auto Gamma" }, hsnCode: { type: String, default: "" } }],
  accessories: [{ id: String, accessoryId: String, name: String, category: String, price: Number, quantity: Number, business: { type: String, default: "Auto Gamma" }, hsnCode: { type: String, default: "" } }],
  laborCharge: { type: Number, default: 0 },
  laborBusiness: { type: String, default: "Auto Gamma" },
  autoGammaDiscount: { type: Number, default: 0 },
  agnxDiscount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  gst: { type: Number, default: 18 },
  gstMode: { type: String, enum: ["exclusive", "inclusive"], default: "exclusive" },
  serviceNotes: { type: String },
  status: { type: String, enum: ["Pending", "In Progress", "Completed", "Cancelled"], default: "Pending" },
  date: { type: String, required: true },
  estimatedCost: { type: Number, required: true },
  technician: { type: String },
  vehicleType: { type: String },
  gstNumber: { type: String, default: "" },
  isPaid: { type: Boolean, default: false },
  payments: [{
    amount: Number,
    method: String,
    date: String
  }],
  perBusinessPayments: {
    "Auto Gamma": {
      amount: Number,
      method: String,
      date: String,
    },
    AGNX: {
      amount: Number,
      method: String,
      date: String,
    },
  },
});

export const JobCardModel = mongoose.model("JobCard", jobCardMongoSchema);

const invoiceMongoSchema = new mongoose.Schema({
  invoiceNo: { type: String, required: true, unique: true },
  jobCardId: { type: String, required: true },
  business: { type: String, enum: ["Auto Gamma", "AGNX"], required: true },
  customerName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  emailAddress: { type: String },
  vehicleInfo: { type: String },
  vehicleMake: { type: String },
  vehicleModel: { type: String },
  vehicleYear: { type: String },
  licensePlate: { type: String },
  vehicleType: { type: String },
  items: [{
    name: String,
    price: Number,
    quantity: { type: Number, default: 1 },
    type: { type: String, enum: ["Service", "PPF", "Accessory", "Labor"] },
    category: String,
    warranty: String,
    vehicleType: String,
    rollUsed: Number,
    technician: String,
    hsnCode: { type: String, default: "" }
  }],
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  laborCharge: { type: Number, default: 0 },
  gstPercentage: { type: Number, default: 18 },
  gstMode: { type: String, enum: ["exclusive", "inclusive"], default: "exclusive" },
  gstAmount: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  date: { type: String, required: true },
  customerGstNumber: { type: String, default: "" },
  isPaid: { type: Boolean, default: false },
  paymentMethod: { type: String },
  paymentDate: { type: String },
  payments: [{
    amount: Number,
    method: String,
    date: String
  }]
});

export const InvoiceModel = mongoose.model("Invoice", invoiceMongoSchema);

const ticketMongoSchema = new mongoose.Schema({
  customerId: { type: String, default: "" },
  customerName: { type: String, required: true },
  phone: { type: String, default: "" },
  note: { type: String, required: true },
  createdAt: { type: String, required: true }
});

export const TicketModel = mongoose.model("Ticket", ticketMongoSchema);

const oldCustomerMongoSchema = new mongoose.Schema({
  name: { type: String, required: true },
  number: { type: String, required: true },
  vehicleNumber: { type: String, required: true },
  notes: { type: String, default: "NA" },
  createdAt: { type: String, required: true }
});

export const OldCustomerModel = mongoose.model("OldCustomer", oldCustomerMongoSchema);

const vendorMongoSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contactPerson: { type: String, default: "" },
  phone: { type: String, default: "" },
  email: { type: String, default: "" },
  address: { type: String, default: "" },
  category: { type: String, default: "" },
  categories: { type: [String], default: [] },
  notes: { type: String, default: "" },
  createdAt: { type: String, required: true },
});

export const VendorModel = mongoose.model("Vendor", vendorMongoSchema);

const vendorPurchaseMongoSchema = new mongoose.Schema({
  vendorId: { type: String, required: true },
  vendorName: { type: String, default: "" },
  items: [{
    name: String,
    quantity: Number,
    unit: { type: String, default: "pcs" },
    unitPrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    hsnCode: { type: String, default: "" },
    itemType: { type: String, default: "PPF" },
    categoryName: { type: String, default: "" },
    rollName: { type: String, default: "" },
    ppfPricing: { type: mongoose.Schema.Types.Mixed, default: [] },
  }],
  totalAmount: { type: Number, default: 0 },
  sellingTotal: { type: Number, default: 0 },
  gstEnabled: { type: Boolean, default: false },
  gstType: { type: String, enum: ["none", "external", "internal"], default: "none" },
  cgstPercent: { type: Number, default: 0 },
  sgstPercent: { type: Number, default: 0 },
  cgstAmount: { type: Number, default: 0 },
  sgstAmount: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  purchaseDate: { type: String, required: true },
  receivedDate: { type: String, default: "" },
  status: { type: String, enum: ["ordered", "received", "partial"], default: "ordered" },
  paymentStatus: { type: String, enum: ["paid", "partially_paid", "unpaid"], default: "unpaid" },
  payments: [{
    method: { type: String, default: "" },
    date: { type: String, default: "" },
    amount: { type: Number, default: 0 },
  }],
  notes: { type: String, default: "" },
  createdAt: { type: String, required: true },
});

export const VendorPurchaseModel = mongoose.model("VendorPurchase", vendorPurchaseMongoSchema);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getDashboardData(): Promise<DashboardData>;
  
  // Masters
  getServices(): Promise<ServiceMaster[]>;
  createService(service: InsertServiceMaster): Promise<ServiceMaster>;
  updateService(id: string, service: Partial<ServiceMaster>): Promise<ServiceMaster | undefined>;
  deleteService(id: string): Promise<boolean>;

  getPPFs(): Promise<PPFMaster[]>;
  createPPF(ppf: InsertPPFMaster): Promise<PPFMaster>;
  updatePPF(id: string, ppf: Partial<PPFMaster>): Promise<PPFMaster | undefined>;
  deletePPF(id: string): Promise<boolean>;

  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: any): Promise<Invoice>;
  updateInvoice(id: string, invoice: Partial<Invoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string): Promise<boolean>;
  getCustomers(): Promise<any[]>;

  getAccessories(): Promise<AccessoryMaster[]>;
  createAccessory(accessory: InsertAccessoryMaster): Promise<AccessoryMaster>;
  updateAccessory(id: string, accessory: Partial<AccessoryMaster>): Promise<AccessoryMaster | undefined>;
  adjustAccessoryInventory(id: string, delta: number): Promise<AccessoryMaster | undefined>;
  receiveAccessoryStock(id: string, quantity: number): Promise<AccessoryMaster | undefined>;
  deleteAccessory(id: string): Promise<boolean>;

  getVehicleTypes(): Promise<VehicleType[]>;
  createVehicleType(name: string): Promise<VehicleType>;

  // Accessory Categories
  getAccessoryCategories(): Promise<AccessoryCategory[]>;
  createAccessoryCategory(name: string): Promise<AccessoryCategory>;
  updateAccessoryCategory(id: string, name: string): Promise<AccessoryCategory | undefined>;
  deleteAccessoryCategory(id: string): Promise<boolean>;

  // Technicians
  getTechnicians(): Promise<Technician[]>;
  createTechnician(technician: InsertTechnician): Promise<Technician>;
  updateTechnician(id: string, technician: Partial<Technician>): Promise<Technician | undefined>;
  deleteTechnician(id: string): Promise<boolean>;
  // Technician Salary Records
  getSalaryRecords(technicianId: string): Promise<TechnicianSalaryRecord[]>;
  createSalaryRecord(record: InsertTechnicianSalaryRecord): Promise<TechnicianSalaryRecord>;
  updateSalaryRecord(id: string, record: Partial<InsertTechnicianSalaryRecord>): Promise<TechnicianSalaryRecord | undefined>;
  deleteSalaryRecord(id: string): Promise<boolean>;
  // Technician Absences
  getAbsences(technicianId: string): Promise<TechnicianAbsence[]>;
  createAbsence(absence: InsertTechnicianAbsence): Promise<TechnicianAbsence>;
  deleteAbsence(id: string): Promise<boolean>;
  // Technician Increments
  getIncrements(technicianId: string): Promise<TechnicianIncrement[]>;
  createIncrement(increment: InsertTechnicianIncrement): Promise<TechnicianIncrement>;
  deleteIncrement(id: string): Promise<boolean>;

  // Employee Loans
  getEmployeeLoans(): Promise<EmployeeLoan[]>;
  createEmployeeLoan(loan: InsertEmployeeLoan): Promise<EmployeeLoan>;
  addLoanRepayment(id: string, repayment: InsertLoanRepayment): Promise<EmployeeLoan | undefined>;
  deleteEmployeeLoan(id: string): Promise<boolean>;

  // User
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;

  // Appointments
  getAppointments(): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, appointment: Partial<Appointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: string): Promise<boolean>;

  // Inquiries
  getInquiries(): Promise<Inquiry[]>;
  createInquiry(inquiry: InsertInquiry): Promise<Inquiry>;
  updateInquiry(id: string, inquiry: Partial<Inquiry>): Promise<Inquiry | undefined>;
  deleteInquiry(id: string): Promise<boolean>;

  // Tickets
  getTickets(): Promise<any[]>;
  createTicket(ticket: any): Promise<any>;
  updateTicket(id: string, ticket: any): Promise<any | undefined>;
  deleteTicket(id: string): Promise<boolean>;

  // Job Cards
  getJobCard(id: string): Promise<JobCard | undefined>;
  getJobCards(): Promise<JobCard[]>;
  createJobCard(jobCard: InsertJobCard): Promise<JobCard>;
  updateJobCard(id: string, jobCard: Partial<JobCard>): Promise<JobCard | undefined>;
  deleteJobCard(id: string): Promise<boolean>;

  // Old Customers
  getOldCustomers(page: number, limit: number): Promise<{ customers: any[], total: number }>;
  createOldCustomer(customer: any): Promise<any>;

  // HSN Codes
  getHsnCodes(): Promise<{ id: string; code: string; description: string }[]>;
  createHsnCode(data: { code: string; description: string }): Promise<{ id: string; code: string; description: string }>;
  updateHsnCode(id: string, data: { code?: string; description?: string }): Promise<{ id: string; code: string; description: string } | undefined>;
  deleteHsnCode(id: string): Promise<boolean>;

  // Expenses
  getExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;

  // Vendor Management
  getVendors(): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | undefined>;
  createVendor(vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: string): Promise<boolean>;

  getVendorPurchases(vendorId?: string): Promise<VendorPurchase[]>;
  getVendorPurchase(id: string): Promise<VendorPurchase | undefined>;
  createVendorPurchase(purchase: InsertVendorPurchase): Promise<VendorPurchase>;
  updateVendorPurchase(id: string, purchase: Partial<InsertVendorPurchase>): Promise<VendorPurchase | undefined>;
  deleteVendorPurchase(id: string): Promise<boolean>;

  // Resell Orders
  getResellOrders(): Promise<ResellOrder[]>;
  createResellOrder(order: InsertResellOrder): Promise<ResellOrder>;
  updateResellOrder(id: string, order: Partial<InsertResellOrder>): Promise<ResellOrder | undefined>;
  deleteResellOrder(id: string): Promise<boolean>;

  // Warranty
  getWarrantyItems(): Promise<any[]>;
  getWarrantyFollowUps(): Promise<WarrantyFollowUp[]>;
  getWarrantyFollowUp(id: string): Promise<WarrantyFollowUp | undefined>;
  createWarrantyFollowUp(data: InsertWarrantyFollowUp): Promise<WarrantyFollowUp>;
  updateWarrantyFollowUp(id: string, data: Partial<InsertWarrantyFollowUp>): Promise<WarrantyFollowUp | undefined>;
  deleteWarrantyFollowUp(id: string): Promise<boolean>;

  // WhatsApp Inquiries
  getWhatsAppInquiries(): Promise<any[]>;
  getWhatsAppInquiry(id: string): Promise<any | undefined>;
  createWhatsAppInquiry(data: any): Promise<any>;
  updateWhatsAppInquiry(id: string, data: any): Promise<any | undefined>;
  deleteWhatsAppInquiry(id: string): Promise<boolean>;

  sessionStore: session.Store;
}

export class MongoStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MongoDBStore({
      uri: process.env.MONGODB_URI || "mongodb://localhost:27017/autogamma",
      collection: "sessions",
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const user = await UserModel.findById(id);
    if (!user) return undefined;
    return { 
      id: user._id.toString(), 
      email: user.email, 
      password: user.password as string | undefined, 
      name: user.name as string | undefined 
    };
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await UserModel.findOne({ email });
    if (!user) return undefined;
    return { 
      id: user._id.toString(), 
      email: user.email, 
      password: user.password as string | undefined, 
      name: user.name as string | undefined 
    };
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user = new UserModel(insertUser);
    await user.save();
    return { id: user._id.toString(), email: user.email, password: user.password };
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const user = await UserModel.findByIdAndUpdate(id, data, { new: true });
    if (!user) return undefined;
    return {
      id: user._id.toString(),
      email: user.email,
      password: user.password as string | undefined,
      name: user.name as string | undefined
    };
  }

  async getDashboardData(): Promise<DashboardData> {
    const inquiries = await InquiryModel.find();
    const jobCards = await JobCardModel.find();
    const invoices = await InvoiceModel.find();
    const tickets = await TicketModel.find();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const inquiriesToday = await InquiryModel.countDocuments({
      createdAt: { $gte: startOfToday.toISOString() }
    });

    // Calculate total balance from all invoices (partial + unpaid)
    const totalBalance = invoices.reduce((acc, inv) => {
      const paidAmount = (inv.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      const balance = inv.totalAmount - paidAmount;
      return acc + (balance > 0 ? balance : 0);
    }, 0);

    const twoDaysLater = new Date();
    twoDaysLater.setDate(twoDaysLater.getDate() + 2);
    twoDaysLater.setHours(23, 59, 59, 999);

    const upcomingAppointments = await AppointmentModel.find({
      status: "SCHEDULED",
      date: { 
        $gte: new Date().toISOString().split('T')[0],
        $lte: twoDaysLater.toISOString().split('T')[0]
      }
    }).sort({ date: 1, time: 1 }).limit(10);

    return {
      stats: [
        { label: "Inquiries Today", value: inquiriesToday.toString(), subtext: "Inquiries received today", icon: "MessageCircle" },
        { label: "Balance Amount", value: totalBalance.toLocaleString(), subtext: "Unpaid + Partial balances", icon: "IndianRupee" },
      ],
      salesTrends: [],
      customerStatus: [],
      customerGrowth: [],
      inventoryByCategory: [],
      activeJobs: tickets.map(t => ({
        id: t._id.toString(),
        customerName: t.customerName,
        vehicleInfo: t.note,
        status: "Open",
      })),
      upcomingAppointments: upcomingAppointments.map(a => ({
        id: a._id.toString(),
        customerName: a.customerName,
        vehicleInfo: a.vehicleInfo,
        date: a.date,
        time: a.time,
        serviceType: a.serviceType,
      })),
    };
  }

  async getServices(): Promise<ServiceMaster[]> {
    const services = await ServiceMasterModel.find();
    return services.map(s => ({
      id: s._id.toString(),
      name: s.name,
      hsnCode: (s as any).hsnCode || "",
      pricingByVehicleType: s.pricingByVehicleType as any
    }));
  }

  async createService(service: InsertServiceMaster): Promise<ServiceMaster> {
    const s = new ServiceMasterModel(service);
    await s.save();
    return {
      id: s._id.toString(),
      name: s.name,
      hsnCode: (s as any).hsnCode || "",
      pricingByVehicleType: s.pricingByVehicleType as any
    };
  }

  async updateService(id: string, service: Partial<ServiceMaster>): Promise<ServiceMaster | undefined> {
    const s = await ServiceMasterModel.findByIdAndUpdate(id, service, { new: true });
    if (!s) return undefined;
    return {
      id: s._id.toString(),
      name: s.name,
      hsnCode: (s as any).hsnCode || "",
      pricingByVehicleType: s.pricingByVehicleType as any
    };
  }

  async deleteService(id: string): Promise<boolean> {
    const result = await ServiceMasterModel.findByIdAndDelete(id);
    return !!result;
  }

  async getPPFs(): Promise<PPFMaster[]> {
    const ppfs = await PPFMasterModel.find();
    return ppfs.map(s => ({
      id: s._id.toString(),
      name: s.name,
      hsnCode: (s as any).hsnCode || "",
      pricingByVehicleType: s.pricingByVehicleType as any,
      rolls: (s.rolls as any[]).map((r: any) => ({
        ...r.toObject?.() ?? r,
        id: r._id?.toString() ?? r.id,
      })),
    }));
  }

  async createPPF(ppf: InsertPPFMaster): Promise<PPFMaster> {
    const s = new PPFMasterModel(ppf);
    await s.save();
    return {
      id: s._id.toString(),
      name: s.name,
      hsnCode: (s as any).hsnCode || "",
      pricingByVehicleType: s.pricingByVehicleType as any,
      rolls: (s.rolls as any[]).map((r: any) => ({
        ...r.toObject?.() ?? r,
        id: r._id?.toString() ?? r.id,
      })),
    };
  }

  async updatePPF(id: string, ppf: Partial<PPFMaster>): Promise<PPFMaster | undefined> {
    const s = await PPFMasterModel.findByIdAndUpdate(id, ppf, { new: true });
    if (!s) return undefined;
    return {
      id: s._id.toString(),
      name: s.name,
      hsnCode: (s as any).hsnCode || "",
      pricingByVehicleType: s.pricingByVehicleType as any,
      rolls: (s.rolls as any[]).map((r: any) => ({
        ...r.toObject?.() ?? r,
        id: r._id?.toString() ?? r.id,
      })),
    };
  }

  async deletePPF(id: string): Promise<boolean> {
    const result = await PPFMasterModel.findByIdAndDelete(id);
    return !!result;
  }

  async getAccessories(): Promise<AccessoryMaster[]> {
    const accessories = await AccessoryMasterModel.find();
    return accessories.map(a => ({
      id: a._id.toString(),
      category: a.category,
      name: a.name,
      quantity: a.quantity,
      buffer: (a as any).buffer || 0,
      price: a.price,
      hsnCode: (a as any).hsnCode || "",
      hasDualPricing: (a as any).hasDualPricing || false,
      price4Window: (a as any).price4Window || 0,
      price6Window: (a as any).price6Window || 0,
    }));
  }

  async createAccessory(accessory: InsertAccessoryMaster): Promise<AccessoryMaster> {
    const a = new AccessoryMasterModel({
      ...accessory,
      quantity: Math.max(0, Number(accessory.quantity) || 0),
      buffer: Math.max(0, Number(accessory.buffer) || 0),
    });
    await a.save();
    return {
      id: a._id.toString(),
      category: a.category,
      name: a.name,
      quantity: a.quantity,
      buffer: (a as any).buffer || 0,
      price: a.price,
      hsnCode: (a as any).hsnCode || "",
      hasDualPricing: (a as any).hasDualPricing || false,
      price4Window: (a as any).price4Window || 0,
      price6Window: (a as any).price6Window || 0,
    };
  }

  async updateAccessory(id: string, accessory: Partial<AccessoryMaster>): Promise<AccessoryMaster | undefined> {
    const existing = await AccessoryMasterModel.findById(id);
    if (!existing) return undefined;

    const updateData: Record<string, unknown> = { ...accessory };
    if (Object.prototype.hasOwnProperty.call(accessory, "quantity")) {
      const requestedQuantity = Math.max(0, Number(accessory.quantity) || 0);
      const currentQuantity = Math.max(0, Number(existing.quantity) || 0);
      const currentBuffer = Math.max(0, Number((existing as any).buffer) || 0);
      const inventory =
        requestedQuantity > currentQuantity
          ? applyAccessoryStockReceipt(
              currentQuantity,
              currentBuffer,
              requestedQuantity - currentQuantity,
            )
          : {
              quantity: requestedQuantity,
              buffer: currentBuffer,
            };
      updateData.quantity = inventory.quantity;
      updateData.buffer = inventory.buffer;
    } else {
      delete updateData.buffer;
    }

    const a = await AccessoryMasterModel.findByIdAndUpdate(id, updateData, { new: true });
    if (!a) return undefined;
    return {
      id: a._id.toString(),
      category: a.category,
      name: a.name,
      quantity: a.quantity,
      buffer: (a as any).buffer || 0,
      price: a.price,
      hsnCode: (a as any).hsnCode || "",
      hasDualPricing: (a as any).hasDualPricing || false,
      price4Window: (a as any).price4Window || 0,
      price6Window: (a as any).price6Window || 0,
    };
  }

  async adjustAccessoryInventory(
    id: string,
    delta: number,
  ): Promise<AccessoryMaster | undefined> {
    const accessory = await AccessoryMasterModel.findById(id);
    if (!accessory) return undefined;

    const inventory = applyAccessoryInventoryDelta(
      accessory.quantity,
      (accessory as any).buffer,
      delta,
    );
    accessory.quantity = inventory.quantity;
    (accessory as any).buffer = inventory.buffer;
    await accessory.save();

    return {
      id: accessory._id.toString(),
      category: accessory.category,
      name: accessory.name,
      quantity: accessory.quantity,
      buffer: (accessory as any).buffer || 0,
      price: accessory.price,
      hsnCode: (accessory as any).hsnCode || "",
      hasDualPricing: (accessory as any).hasDualPricing || false,
      price4Window: (accessory as any).price4Window || 0,
      price6Window: (accessory as any).price6Window || 0,
    };
  }

  async receiveAccessoryStock(
    id: string,
    quantity: number,
  ): Promise<AccessoryMaster | undefined> {
    const accessory = await AccessoryMasterModel.findById(id);
    if (!accessory) return undefined;

    const inventory = applyAccessoryStockReceipt(
      accessory.quantity,
      (accessory as any).buffer,
      quantity,
    );
    accessory.quantity = inventory.quantity;
    (accessory as any).buffer = inventory.buffer;
    await accessory.save();

    return {
      id: accessory._id.toString(),
      category: accessory.category,
      name: accessory.name,
      quantity: accessory.quantity,
      buffer: (accessory as any).buffer || 0,
      price: accessory.price,
      hsnCode: (accessory as any).hsnCode || "",
      hasDualPricing: (accessory as any).hasDualPricing || false,
      price4Window: (accessory as any).price4Window || 0,
      price6Window: (accessory as any).price6Window || 0,
    };
  }

  async deleteAccessory(id: string): Promise<boolean> {
    const result = await AccessoryMasterModel.findByIdAndDelete(id);
    return !!result;
  }

  async getVehicleTypes(): Promise<VehicleType[]> {
    const types = await VehicleTypeModel.find();
    return types.map(t => ({
      id: t._id.toString(),
      name: t.name
    }));
  }

  async createVehicleType(name: string): Promise<VehicleType> {
    const t = new VehicleTypeModel({ name });
    await t.save();
    return {
      id: t._id.toString(),
      name: t.name
    };
  }

  async getAccessoryCategories(): Promise<AccessoryCategory[]> {
    const categories = await AccessoryCategoryModel.find();
    return categories.map(c => ({
      id: c._id.toString(),
      name: c.name
    }));
  }

  async createAccessoryCategory(name: string): Promise<AccessoryCategory> {
    const c = new AccessoryCategoryModel({ name });
    await c.save();
    return {
      id: c._id.toString(),
      name: c.name
    };
  }

  async updateAccessoryCategory(id: string, name: string): Promise<AccessoryCategory | undefined> {
    const c = await AccessoryCategoryModel.findByIdAndUpdate(id, { name }, { new: true });
    if (!c) return undefined;
    return {
      id: c._id.toString(),
      name: c.name
    };
  }

  async deleteAccessoryCategory(id: string): Promise<boolean> {
    const result = await AccessoryCategoryModel.findByIdAndDelete(id);
    return !!result;
  }

  async getHsnCodes(): Promise<{ id: string; code: string; description: string }[]> {
    const codes = await HsnCodeModel.find().sort({ code: 1 });
    return codes.map(c => ({ id: c._id.toString(), code: c.code, description: c.description }));
  }

  async createHsnCode(data: { code: string; description: string }): Promise<{ id: string; code: string; description: string }> {
    const c = new HsnCodeModel(data);
    await c.save();
    return { id: c._id.toString(), code: c.code, description: c.description };
  }

  async updateHsnCode(id: string, data: { code?: string; description?: string }): Promise<{ id: string; code: string; description: string } | undefined> {
    const c = await HsnCodeModel.findByIdAndUpdate(id, data, { new: true });
    if (!c) return undefined;
    return { id: c._id.toString(), code: c.code, description: c.description };
  }

  async deleteHsnCode(id: string): Promise<boolean> {
    const result = await HsnCodeModel.findByIdAndDelete(id);
    return !!result;
  }

  async getExpenses(): Promise<Expense[]> {
    const expenses = await ExpenseModel.find().sort({ date: -1, createdAt: -1 });
    return expenses.map(e => ({
      id: e._id.toString(),
      name: e.name,
      details: (e as any).details || "",
      price: e.price,
      date: e.date,
      category: (e as any).category || "",
      paymentMode: (e as any).paymentMode || "",
      createdAt: (e as any).createdAt || new Date().toISOString(),
    }));
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const e = await ExpenseModel.findById(id);
    if (!e) return undefined;
    return {
      id: e._id.toString(),
      name: e.name,
      details: (e as any).details || "",
      price: e.price,
      date: e.date,
      category: (e as any).category || "",
      paymentMode: (e as any).paymentMode || "",
      createdAt: (e as any).createdAt || new Date().toISOString(),
    };
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const e = new ExpenseModel({ ...expense, createdAt: new Date().toISOString() });
    await e.save();
    return {
      id: e._id.toString(),
      name: e.name,
      details: (e as any).details || "",
      price: e.price,
      date: e.date,
      category: (e as any).category || "",
      paymentMode: (e as any).paymentMode || "",
      createdAt: (e as any).createdAt || new Date().toISOString(),
    };
  }

  async updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense | undefined> {
    const e = await ExpenseModel.findByIdAndUpdate(id, expense, { new: true });
    if (!e) return undefined;
    return {
      id: e._id.toString(),
      name: e.name,
      details: (e as any).details || "",
      price: e.price,
      date: e.date,
      category: (e as any).category || "",
      paymentMode: (e as any).paymentMode || "",
      createdAt: (e as any).createdAt || new Date().toISOString(),
    };
  }

  async deleteExpense(id: string): Promise<boolean> {
    const result = await ExpenseModel.findByIdAndDelete(id);
    return !!result;
  }

  private mapTechnician(t: any): Technician {
    return {
      id: t._id.toString(),
      name: t.name,
      specialty: t.specialty,
      phone: t.phone || undefined,
      status: t.status as "active" | "inactive",
      monthlySalary: t.monthlySalary ?? 0,
      joiningDate: t.joiningDate ?? "",
    };
  }

  async getTechnicians(): Promise<Technician[]> {
    const technicians = await TechnicianModel.find();
    return technicians.map(t => this.mapTechnician(t));
  }

  async createTechnician(technician: InsertTechnician): Promise<Technician> {
    const t = new TechnicianModel(technician);
    await t.save();
    return this.mapTechnician(t);
  }

  async updateTechnician(id: string, technician: Partial<Technician>): Promise<Technician | undefined> {
    const t = await TechnicianModel.findByIdAndUpdate(id, technician, { new: true });
    if (!t) return undefined;
    return this.mapTechnician(t);
  }

  async deleteTechnician(id: string): Promise<boolean> {
    const result = await TechnicianModel.findByIdAndDelete(id);
    return !!result;
  }

  private mapSalaryRecord(r: any): TechnicianSalaryRecord {
    return {
      id: r._id.toString(),
      technicianId: r.technicianId,
      month: r.month,
      year: r.year,
      baseSalary: r.baseSalary ?? 0,
      salaryDue: r.salaryDue ?? 0,
      paidAmount: r.paidAmount ?? 0,
      paymentStatus: r.paymentStatus as "paid" | "partial" | "unpaid",
      payments: r.payments ?? [],
      notes: r.notes ?? "",
    };
  }

  async getSalaryRecords(technicianId: string): Promise<TechnicianSalaryRecord[]> {
    const records = await TechnicianSalaryRecordModel.find({ technicianId }).sort({ year: -1, month: -1 });
    return records.map(r => this.mapSalaryRecord(r));
  }

  async createSalaryRecord(record: InsertTechnicianSalaryRecord): Promise<TechnicianSalaryRecord> {
    const paidAmount = (record.payments ?? []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const paymentStatus = paidAmount === 0 ? "unpaid" : paidAmount >= record.salaryDue ? "paid" : "partial";
    const r = new TechnicianSalaryRecordModel({ ...record, paidAmount, paymentStatus });
    await r.save();
    return this.mapSalaryRecord(r);
  }

  async updateSalaryRecord(id: string, record: Partial<InsertTechnicianSalaryRecord>): Promise<TechnicianSalaryRecord | undefined> {
    const existing = await TechnicianSalaryRecordModel.findById(id);
    if (!existing) return undefined;
    const updatedPayments = record.payments ?? existing.payments ?? [];
    const paidAmount = updatedPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const salaryDue = record.salaryDue ?? existing.salaryDue ?? 0;
    const paymentStatus = paidAmount === 0 ? "unpaid" : paidAmount >= salaryDue ? "paid" : "partial";
    const r = await TechnicianSalaryRecordModel.findByIdAndUpdate(
      id, { ...record, paidAmount, paymentStatus }, { new: true }
    );
    if (!r) return undefined;
    return this.mapSalaryRecord(r);
  }

  async deleteSalaryRecord(id: string): Promise<boolean> {
    const result = await TechnicianSalaryRecordModel.findByIdAndDelete(id);
    return !!result;
  }

  async getAbsences(technicianId: string): Promise<TechnicianAbsence[]> {
    const absences = await TechnicianAbsenceModel.find({ technicianId }).sort({ date: -1 });
    return absences.map(a => ({ id: a._id.toString(), technicianId: a.technicianId, date: a.date, reason: a.reason ?? "" }));
  }

  async createAbsence(absence: InsertTechnicianAbsence): Promise<TechnicianAbsence> {
    const a = new TechnicianAbsenceModel(absence);
    await a.save();
    return { id: a._id.toString(), technicianId: a.technicianId, date: a.date, reason: a.reason ?? "" };
  }

  async deleteAbsence(id: string): Promise<boolean> {
    const result = await TechnicianAbsenceModel.findByIdAndDelete(id);
    return !!result;
  }

  async getIncrements(technicianId: string): Promise<TechnicianIncrement[]> {
    const increments = await TechnicianIncrementModel.find({ technicianId }).sort({ effectiveDate: -1 });
    return increments.map(i => ({
      id: i._id.toString(), technicianId: i.technicianId,
      previousSalary: i.previousSalary, newSalary: i.newSalary,
      effectiveDate: i.effectiveDate, notes: i.notes ?? "",
    }));
  }

  async createIncrement(increment: InsertTechnicianIncrement): Promise<TechnicianIncrement> {
    const i = new TechnicianIncrementModel(increment);
    await i.save();
    return {
      id: i._id.toString(), technicianId: i.technicianId,
      previousSalary: i.previousSalary, newSalary: i.newSalary,
      effectiveDate: i.effectiveDate, notes: i.notes ?? "",
    };
  }

  async deleteIncrement(id: string): Promise<boolean> {
    const result = await TechnicianIncrementModel.findByIdAndDelete(id);
    return !!result;
  }

  private mapEmployeeLoan(loan: any): EmployeeLoan {
    const repayments = (loan.repayments ?? []).map((repayment: any) => ({
      id: repayment.id,
      amount: repayment.amount,
      date: repayment.date,
      notes: repayment.notes ?? "",
    }));
    const totalRepaid = repayments.reduce((sum: number, repayment: any) => sum + repayment.amount, 0);
    const outstandingBalance = Math.max(0, loan.amount - totalRepaid);
    const nextPaymentDate = outstandingBalance > 0
      ? new Date(Math.max(
          new Date(loan.firstRepaymentDate).getTime(),
          ...repayments.map((repayment: any) => new Date(repayment.date).getTime()),
        )).toISOString().split("T")[0]
      : "";
    const nextDate = outstandingBalance > 0
      ? (repayments.length === 0
          ? loan.firstRepaymentDate
          : new Date(new Date(repayments[repayments.length - 1].date).setMonth(
              new Date(repayments[repayments.length - 1].date).getMonth() + 1,
            )).toISOString().split("T")[0])
      : "";
    const status = outstandingBalance === 0
      ? "paid"
      : nextDate && nextDate < new Date().toISOString().split("T")[0]
        ? "overdue"
        : "active";
    return {
      id: loan._id.toString(),
      employeeId: loan.employeeId,
      employeeName: loan.employeeName,
      amount: loan.amount,
      monthlyRepayment: loan.monthlyRepayment,
      loanDate: loan.loanDate,
      firstRepaymentDate: loan.firstRepaymentDate,
      notes: loan.notes ?? "",
      repayments,
      totalRepaid,
      outstandingBalance,
      nextPaymentDate: nextDate || nextPaymentDate,
      status,
    };
  }

  async getEmployeeLoans(): Promise<EmployeeLoan[]> {
    const loans = await EmployeeLoanModel.find().sort({ loanDate: -1 });
    return loans.map((loan) => this.mapEmployeeLoan(loan));
  }

  async createEmployeeLoan(loan: InsertEmployeeLoan): Promise<EmployeeLoan> {
    const employee = await TechnicianModel.findById(loan.employeeId);
    if (!employee) throw new Error("Employee not found");
    const saved = new EmployeeLoanModel({
      ...loan,
      employeeName: employee.name,
      repayments: [],
    });
    await saved.save();
    return this.mapEmployeeLoan(saved);
  }

  async deleteEmployeeLoan(id: string): Promise<boolean> {
    const deleted = await EmployeeLoanModel.findByIdAndDelete(id);
    return !!deleted;
  }

  async addLoanRepayment(id: string, repayment: InsertLoanRepayment): Promise<EmployeeLoan | undefined> {
    const loan = await EmployeeLoanModel.findById(id);
    if (!loan) return undefined;
    const totalRepaid = (loan.repayments ?? []).reduce((sum: number, item: any) => sum + item.amount, 0);
    if (repayment.amount > loan.amount - totalRepaid) {
      throw new Error("Repayment cannot be greater than the outstanding balance");
    }
    loan.repayments.push({ id: crypto.randomUUID(), ...repayment } as any);
    await loan.save();
    return this.mapEmployeeLoan(loan);
  }

  async getAppointments(): Promise<Appointment[]> {
    const appointments = await AppointmentModel.find();
    return appointments.map(a => ({
      id: a._id.toString(),
      customerName: a.customerName,
      phone: a.phone,
      vehicleInfo: a.vehicleInfo,
      serviceType: a.serviceType,
      date: a.date,
      time: a.time,
      priority: a.priority as any,
      status: a.status as any,
      cancelReason: a.cancelReason || undefined
    }));
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const a = new AppointmentModel(appointment);
    await a.save();
    return {
      id: a._id.toString(),
      customerName: a.customerName,
      phone: a.phone,
      vehicleInfo: a.vehicleInfo,
      serviceType: a.serviceType,
      date: a.date,
      time: a.time,
      priority: a.priority as any,
      status: a.status as any
    };
  }

  async updateAppointment(id: string, appointment: Partial<Appointment>): Promise<Appointment | undefined> {
    const a = await AppointmentModel.findByIdAndUpdate(id, appointment, { new: true });
    if (!a) return undefined;
    return {
      id: a._id.toString(),
      customerName: a.customerName,
      phone: a.phone,
      vehicleInfo: a.vehicleInfo,
      serviceType: a.serviceType,
      date: a.date,
      time: a.time,
      priority: a.priority as any,
      status: a.status as any,
      cancelReason: a.cancelReason || undefined
    };
  }

  async deleteAppointment(id: string): Promise<boolean> {
    const result = await AppointmentModel.findByIdAndDelete(id);
    return !!result;
  }

  // Job Cards
  async getJobCard(id: string): Promise<JobCard | undefined> {
    const j = await JobCardModel.findById(id);
    if (!j) return undefined;
    return {
      ...j.toObject(),
      id: j._id.toString(),
      services: (j as any).services?.map((s: any) => ({
        ...s,
        id: s.id || s._id?.toString() || s.serviceId,
        serviceId: s.serviceId || s.id || s._id?.toString(),
        name: s.name || s.serviceName || "Unnamed Service",
        price: s.price || 0
      })) || [],
      ppfs: (j as any).ppfs?.map((p: any) => ({
        ...p,
        id: p.id || p._id?.toString() || p.ppfId || p.pId,
        ppfId: p.ppfId || p.id || p._id?.toString() || p.pId,
        name: p.name || p.ppfName || "Unnamed PPF",
        price: p.price || 0
      })) || [],
      accessories: (j as any).accessories?.map((a: any) => ({
        ...a,
        id: a.id || a._id?.toString() || a.accessoryId,
        accessoryId: a.accessoryId || a.id || a._id?.toString(),
        name: a.name || a.accessoryName || "Unnamed Accessory",
        price: a.price || 0,
        quantity: a.quantity || 1
      })) || [],
      vehicleType: (j as any).vehicleType
    } as JobCard;
  }

  async getJobCards(): Promise<JobCard[]> {
    const jobs = await JobCardModel.find().sort({ _id: -1 });
    return jobs.map(j => ({
      ...j.toObject(),
      id: j._id.toString(),
      services: (j as any).services?.map((s: any) => ({
        ...s,
        id: s.id || s._id?.toString() || s.serviceId,
        serviceId: s.serviceId || s.id || s._id?.toString(),
        name: s.name || s.serviceName || "Unnamed Service",
        price: s.price || 0
      })) || [],
      ppfs: (j as any).ppfs?.map((p: any) => ({
        ...p,
        id: p.id || p._id?.toString() || p.ppfId || p.pId,
        ppfId: p.ppfId || p.id || p._id?.toString() || p.pId,
        name: p.name || p.ppfName || "Unnamed PPF",
        price: p.price || 0
      })) || [],
      accessories: (j as any).accessories?.map((a: any) => ({
        ...a,
        id: a.id || a._id?.toString() || a.accessoryId,
        accessoryId: a.accessoryId || a.id || a._id?.toString(),
        name: a.name || a.accessoryName || "Unnamed Accessory",
        price: a.price || 0,
        quantity: a.quantity || 1
      })) || [],
      vehicleType: (j as any).vehicleType
    })) as JobCard[];
  }

  async getCustomers(): Promise<any[]> {
    try {
      // Fetch latest job cards and old customers
      const [jobCards, oldCustomers] = await Promise.all([
        JobCardModel.find({}, 'customerName phoneNumber emailAddress date').sort({ date: -1 }).limit(100),
        OldCustomerModel.find({}, 'name number createdAt').sort({ createdAt: -1 }).limit(100)
      ]);

      const customersMap = new Map();

      // Merge and sort by latest activity
      const allEntries = [
        ...jobCards.map(jc => ({
          id: jc._id.toString(),
          name: jc.customerName,
          phone: jc.phoneNumber,
          email: jc.emailAddress,
          timestamp: jc.date
        })),
        ...oldCustomers.map(oc => ({
          id: oc._id.toString(),
          name: oc.name,
          phone: oc.number,
          email: "",
          timestamp: oc.createdAt
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      allEntries.forEach(entry => {
        if (!customersMap.has(entry.phone)) {
          customersMap.set(entry.phone, entry);
        }
      });

      return Array.from(customersMap.values());
    } catch (error) {
      console.error("Error in getCustomers:", error);
      throw error;
    }
  }

  async getJobCardsByPhone(phone: string): Promise<any | null> {
    try {
      const jobCards = await JobCardModel.find({ phoneNumber: phone })
        .sort({ date: -1 })
        .select('customerName phoneNumber emailAddress make model year licensePlate vehicleType');
      
      if (jobCards.length === 0) return null;

      const latest = jobCards[0];

      // Build unique vehicles list (preserve insertion order = most recently used first)
      const vehiclesMap = new Map<string, any>();
      jobCards.forEach(jc => {
        const key = `${jc.make}-${jc.model}-${jc.licensePlate}`;
        if (!vehiclesMap.has(key)) {
          vehiclesMap.set(key, {
            make: jc.make,
            model: jc.model,
            year: jc.year || "",
            licensePlate: jc.licensePlate,
            vehicleType: jc.vehicleType || "",
          });
        }
      });

      return {
        customerName: latest.customerName,
        phoneNumber: latest.phoneNumber,
        emailAddress: latest.emailAddress,
        // Legacy single-vehicle fields (most recent) for backward compatibility
        make: latest.make,
        model: latest.model,
        year: latest.year || "",
        licensePlate: latest.licensePlate,
        vehicleType: latest.vehicleType || "",
        // All unique vehicles ordered by most recently used
        vehicles: Array.from(vehiclesMap.values()),
      };
    } catch (error) {
      console.error("Error fetching job card by phone:", error);
      return null;
    }
  }

  async getOldCustomers(page: number, limit: number): Promise<{ customers: any[], total: number }> {
    const skip = (page - 1) * limit;
    const [customers, total] = await Promise.all([
      OldCustomerModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      OldCustomerModel.countDocuments()
    ]);
    return {
      customers: customers.map(c => ({ ...c.toObject(), id: c._id.toString() })),
      total
    };
  }

  async createOldCustomer(customer: any): Promise<any> {
    const oc = new OldCustomerModel({
      ...customer,
      createdAt: new Date().toISOString()
    });
    await oc.save();
    return { ...oc.toObject(), id: oc._id.toString() };
  }

  async createJobCard(jobCard: InsertJobCard): Promise<JobCard> {
    const year = new Date().getFullYear();
    let jobNo = jobCard.jobNo;

    if (!jobNo) {
      const count = await JobCardModel.countDocuments();
      jobNo = `JC-${year}-${(count + 1).toString().padStart(3, "0")}`;
    }

    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      const existing = await JobCardModel.findOne({ jobNo });
      if (!existing) break;

      const parts = jobNo.split("-");
      if (parts.length === 3) {
        const num = parseInt(parts[2]);
        jobNo = `JC-${parts[1]}-${(num + 1).toString().padStart(3, "0")}`;
      } else {
        jobNo = `${jobNo}-${Math.floor(Math.random() * 1000)}`;
      }
      attempts++;
    }

    const j = new JobCardModel({
      ...jobCard,
      jobNo,
      date: jobCard.date || new Date().toISOString()
    });
    await j.save();

    // Generate invoices for new job card
    const businesses = ["Auto Gamma", "AGNX"] as const;
    const yearInvoice = new Date().getFullYear();
    const invoiceNumbers: string[] = [];
    const invoiceNumbersByBusiness: Record<string, string> = {};

    for (const biz of businesses) {
      const bizItems: any[] = [];
      let bizLaborCharge = 0;

      j.services?.forEach((s: any) => {
        if (s.business === biz) {
          bizItems.push({
            name: s.name,
            price: s.price,
            type: "Service",
            technician: s.technician,
            vehicleType: (j as any).vehicleType,
            warranty: s.warranty || undefined,
            hsnCode: s.hsnCode || ""
          });
        }
      });

      j.ppfs?.forEach((p: any) => {
        if (p.business === biz) {
          bizItems.push({
            name: p.name,
            price: p.price,
            type: "PPF",
            warranty: p.warranty || p.warrantyName,
            vehicleType: (j as any).vehicleType,
            rollUsed: p.rollUsed,
            technician: p.technician,
            category: p.ppfId || p.id,
            hsnCode: p.hsnCode || ""
          });
        }
      });

        // Accessories with category
        j.accessories?.forEach((a: any) => {
          if (a.business === biz) {
            bizItems.push({
              name: a.name,
              price: a.price,
              quantity: a.quantity || 1,
              type: "Accessory",
              category: a.category || "",
              hsnCode: a.hsnCode || ""
            });
          }
        });

      if ((j as any).laborBusiness === biz && j.laborCharge > 0) {
        bizLaborCharge = j.laborCharge;
        bizItems.push({ name: "Labor Charge", price: j.laborCharge, type: "Labor" });
      }

      if (bizItems.length > 0) {
        const itemsSubtotal = bizItems.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0);
        
        let discountAmount = 0;
        const autoGammaDiscount = (j as any).autoGammaDiscount || 0;
        const agnxDiscount = (j as any).agnxDiscount || 0;
        const totalDiscount = j.discount || 0;

        const bizCount = [
          ...(j.services || []), 
          ...(j.ppfs || []), 
          ...(j.accessories || [])
        ].reduce((acc, item) => acc.add((item as any).business), new Set<string>()).size;

        if (biz === "Auto Gamma") {
          discountAmount = autoGammaDiscount || (bizCount === 1 ? totalDiscount : 0);
        } else {
          discountAmount = agnxDiscount || (bizCount === 1 ? totalDiscount : 0);
        }

        const subtotalAfterDiscount = itemsSubtotal - discountAmount;
        const gstRate = Number(j.gst ?? 0);
        
        const { gstAmount, totalAmount } = calculateGstAmounts(
          subtotalAfterDiscount,
          gstRate,
          (j as any).gstMode,
        );
        const invoiceTotalAmount = Math.max(0, Math.round(totalAmount));

        const bizPrefix = biz === "Auto Gamma" ? "AG" : "AGNX";
        const invoiceMonthStr = (j.date ? new Date(j.date) : new Date()).toISOString().slice(0, 7); // YYYY-MM
        const lastInvoiceCreate = await InvoiceModel.findOne({
          invoiceNo: { $regex: `^${bizPrefix}-${invoiceMonthStr}-\\d{3}$` }
        }).sort({ invoiceNo: -1 });
        let nextNumCreate = 1;
        if (lastInvoiceCreate) {
          const parts = lastInvoiceCreate.invoiceNo.split("-");
          const lastNum = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastNum)) nextNumCreate = lastNum + 1;
        }
        const invoiceNo = `${bizPrefix}-${invoiceMonthStr}-${nextNumCreate.toString().padStart(3, "0")}`;

        // Per-business payments take priority; fall back to single-business global payments
        const perBizPayCreate = (jobCard as any).perBusinessPayments?.[biz];
        let invoicePaymentsCreate: any[] = [];
        let invoiceIsPaidCreate = false;
        if (perBizPayCreate !== undefined) {
          const amt = Number(perBizPayCreate.amount) || 0;
          if (amt > 0) {
            invoicePaymentsCreate = [{ amount: amt, method: perBizPayCreate.method || "Cash", date: perBizPayCreate.date || new Date().toISOString().split("T")[0] }];
          }
           invoiceIsPaidCreate = amt >= invoiceTotalAmount;
        } else {
          const jobPaymentsCreate: any[] = (jobCard as any).payments || [];
          if (jobPaymentsCreate.length > 0) {
            invoicePaymentsCreate = jobPaymentsCreate;
            const paidAmount = jobPaymentsCreate.reduce(
              (sum: number, payment: any) => sum + (Number(payment.amount) || 0),
              0,
            );
             invoiceIsPaidCreate = paidAmount >= invoiceTotalAmount;
          }
        }

        const inv = new InvoiceModel({
          invoiceNo,
          jobCardId: j._id.toString(),
          business: biz,
          customerName: j.customerName,
          phoneNumber: j.phoneNumber,
          emailAddress: j.emailAddress,
          customerGstNumber: (j as any).gstNumber || "",
          vehicleInfo: `${j.year || "NA"} ${j.make} ${j.model}`,
          vehicleMake: j.make,
          vehicleModel: j.model,
          vehicleYear: j.year || "NA",
          licensePlate: j.licensePlate,
          vehicleType: (j as any).vehicleType,
          items: bizItems,
          subtotal: itemsSubtotal,
          discount: discountAmount,
          laborCharge: bizLaborCharge,
          gstPercentage: j.gst,
          gstMode: (j as any).gstMode || "exclusive",
          gstAmount,
           totalAmount: invoiceTotalAmount,
          date: j.date,
          isPaid: invoiceIsPaidCreate,
          payments: invoicePaymentsCreate
        });
        await inv.save();
        invoiceNumbers.push(inv.invoiceNo);
        invoiceNumbersByBusiness[biz] = inv.invoiceNo;
      }
    }

    // Deduct accessory stock
    if (jobCard.accessories) {
      for (const acc of jobCard.accessories) {
        const accId = (acc as any).accessoryId || (acc as any).id;
        if (!accId || accId === "undefined") continue;
        const accessory = await AccessoryMasterModel.findById(accId);
        if (accessory) {
          const qtyToDeduct = Number(acc.quantity || 1);
          const currentStock = Number(accessory.quantity || 0);
          const currentBuffer = Number((accessory as any).buffer || 0);
          const updated = await this.adjustAccessoryInventory(String(accessory._id), qtyToDeduct);
          console.log(
            `[STORAGE CREATE JOBCARD] Used ${qtyToDeduct} of ${accessory.name}. ` +
            `Old stock: ${currentStock}, New stock: ${updated?.quantity || 0}, ` +
            `Buffer: ${currentBuffer} -> ${updated?.buffer || 0}`,
          );
        }
      }
    }

    // Deduct PPF roll inventory
    if (jobCard.ppfs && jobCard.ppfs.length > 0) {
      // Check if an invoice exists for each business
      const businesses = ["Auto Gamma", "AGNX"] as const;
      const invoiceStatus = new Map<string, boolean>();
      for (const biz of businesses) {
        // We can't check by ID here since it's a new job card, but we check if an invoice with this jobCardId exists
        // Wait, for createJobCard, the jobCardId is j._id which we just created.
        // So an invoice definitely doesn't exist yet for a brand new job card.
        // However, the user might be referring to "same issue" as in stock is being deducted when it shouldn't.
        // In createJobCard, we always create invoices, so we should always deduct stock.
      }

      for (const ppfItem of jobCard.ppfs) {
        const ppfId = (ppfItem as any).ppfId || ppfItem.id;
        const rollsToDeduct = (ppfItem as any).rollsUsed || (ppfItem.rollId ? [{
          rollId: ppfItem.rollId,
          rollUsed: (ppfItem as any).rollUsed
        }] : []);

        if (rollsToDeduct.length > 0 && ppfId) {
          const ppfMaster = await PPFMasterModel.findById(ppfId);
          if (ppfMaster && ppfMaster.rolls) {
            for (const entry of rollsToDeduct) {
              const roll = (ppfMaster.rolls as any[]).find(r => 
                (r._id && r._id.toString() === entry.rollId) || r.id === entry.rollId
              );
              if (roll && entry.rollUsed > 0) {
                roll.stock = Math.max(0, (roll.stock || 0) - entry.rollUsed);
              }
            }
            ppfMaster.markModified("rolls");
            await ppfMaster.save();
          }
        }
      }
    }

    return {
      ...j.toObject(),
      id: j._id.toString(),
      invoiceNumbers,
      invoiceNumbersByBusiness,
    } as JobCard;
  }

  async updateJobCard(id: string, jobCard: Partial<JobCard>): Promise<JobCard | undefined> {
    const existingJob = await JobCardModel.findById(id);
    if (!existingJob) return undefined;

    // Preserve hsnCode from existing job card items when the incoming update has them missing/empty
    if (jobCard.services && (existingJob as any).services?.length) {
      const existingServicesHsn = new Map<string, string>();
      ((existingJob as any).services as any[]).forEach((s: any) => {
        const key = String(s.serviceId || s.id || s._id || "");
        if (key && s.hsnCode) existingServicesHsn.set(key, s.hsnCode);
      });
      jobCard.services = (jobCard.services as any[]).map((s: any) => {
        if (!s.hsnCode) {
          const key = String(s.serviceId || s.id || "");
          const fallback = existingServicesHsn.get(key);
          if (fallback) return { ...s, hsnCode: fallback };
        }
        return s;
      }) as any;
    }

    if (jobCard.ppfs && (existingJob as any).ppfs?.length) {
      const existingPpfsHsn = new Map<string, string>();
      ((existingJob as any).ppfs as any[]).forEach((p: any) => {
        const key = String(p.ppfId || p.id || p._id || "");
        if (key && p.hsnCode) existingPpfsHsn.set(key, p.hsnCode);
      });
      jobCard.ppfs = (jobCard.ppfs as any[]).map((p: any) => {
        if (!p.hsnCode) {
          const key = String(p.ppfId || p.id || "");
          const fallback = existingPpfsHsn.get(key);
          if (fallback) return { ...p, hsnCode: fallback };
        }
        return p;
      }) as any;
    }

    if (jobCard.accessories && (existingJob as any).accessories?.length) {
      const existingAccessoriesHsn = new Map<string, string>();
      ((existingJob as any).accessories as any[]).forEach((a: any) => {
        const key = String(a.accessoryId || a.id || a._id || "");
        if (key && a.hsnCode) existingAccessoriesHsn.set(key, a.hsnCode);
      });
      jobCard.accessories = (jobCard.accessories as any[]).map((a: any) => {
        if (!a.hsnCode) {
          const key = String(a.accessoryId || a.id || "");
          const fallback = existingAccessoriesHsn.get(key);
          if (fallback) return { ...a, hsnCode: fallback };
        }
        return a;
      }) as any;
    }

    // Handle Accessory stock adjustments if accessories are being updated
    if (jobCard.accessories) {
      const oldAccessories = (existingJob.accessories || []) as any[];
      const newAccessories = jobCard.accessories as any[];

      // Map of accessoryId -> quantity
      const oldMap = new Map<string, number>();
      oldAccessories.forEach(a => {
        const accId = String((a as any).accessoryId || (a as any).id || (a as any)._id);
        if (accId && accId !== "undefined") oldMap.set(accId, (oldMap.get(accId) || 0) + (Number(a.quantity) || 1));
      });

      const newMap = new Map<string, number>();
      newAccessories.forEach(a => {
        const accId = String((a as any).accessoryId || (a as any).id || (a as any)._id);
        if (accId && accId !== "undefined") newMap.set(accId, (newMap.get(accId) || 0) + (Number(a.quantity) || 1));
      });

      // Calculate diff and update stock
      const allIds = Array.from(new Set([...Array.from(oldMap.keys()), ...Array.from(newMap.keys())]));
      for (const accId of allIds) {
        const oldQty = oldMap.get(accId) || 0;
        const newQty = newMap.get(accId) || 0;
        const diff = newQty - oldQty;

        if (diff !== 0) {
          const accessory = await AccessoryMasterModel.findById(accId);
          if (accessory) {
            const currentStock = accessory.quantity || 0;
            const currentBuffer = Number((accessory as any).buffer || 0);
            const updated = await this.adjustAccessoryInventory(accId, diff);
            console.log(
              `[STORAGE UPDATE JOBCARD] Accessory ${accessory.name} changed by ${diff}. ` +
              `Old stock: ${currentStock}, New stock: ${updated?.quantity || 0}, ` +
              `Buffer: ${currentBuffer} -> ${updated?.buffer || 0}`,
            );
          }
        }
      }
    }

    // Handle PPF stock adjustments if ppfs are being updated
    if (jobCard.ppfs) {
      const oldPpfs = existingJob.ppfs || [];
      const newPpfs = jobCard.ppfs;

      // Check if an invoice exists for each business
      const businesses = ["Auto Gamma", "AGNX"] as const;
      const invoiceStatus = new Map<string, boolean>();
      for (const biz of businesses) {
        const existingInvoice = await InvoiceModel.findOne({ jobCardId: id, business: biz });
        invoiceStatus.set(biz, !!existingInvoice);
      }

      // 1. Group roll adjustments by ppfId and rollId
      const adjustments = new Map<string, Map<string, number>>();

      // Deduct new quantities only if invoice doesn't exist (it will be created)
      for (const ppfItem of newPpfs) {
        const biz = (ppfItem as any).business || "Auto Gamma";
        const hasInvoice = invoiceStatus.get(biz);
        
        if (hasInvoice) {
          // Invoice already exists, skip deduction for this item
          console.log(`[UPDATE JOB CARD] Invoice exists for ${biz}, skipping PPF deduction for ${ppfItem.name}`);
          continue;
        }

        const ppfId = (ppfItem as any).ppfId || ppfItem.id;
        const rolls = (ppfItem as any).rollsUsed || [];
        
        // If rollsUsed is missing but rollId/rollUsed exist, use them
        if (rolls.length === 0 && (ppfItem as any).rollId) {
          rolls.push({
            rollId: (ppfItem as any).rollId,
            rollUsed: (ppfItem as any).rollUsed || 0
          });
        }

        if (!adjustments.has(ppfId)) adjustments.set(ppfId, new Map());
        const ppfAdjustments = adjustments.get(ppfId)!;

        for (const entry of rolls) {
          if (!entry.rollId) continue;
          const current = ppfAdjustments.get(entry.rollId) || 0;
          ppfAdjustments.set(entry.rollId, current + entry.rollUsed);
        }
      }

      // Add back old quantities - only if we actually deducted them before (i.e., invoice was deleted)
      // If the invoice was deleted, we already replenished the stock in deleteInvoice.
      // So when we "update" the job card, if the invoice is missing, we deduct the NEW quantities.
      // This part is actually correct in the current logic (only deducting for new invoices).
      
      // However, we MUST NOT add back old quantities if the invoice STILL EXISTS, 
      // because we didn't deduct them in this update call, and we shouldn't "re-deduct" or "re-add".
      // The previous code was adding back old quantities UNCONDITIONALLY, which caused issues.
      // I removed the "Add back old quantities" loop in the previous edit, which is correct for the requirement.
      
      // 2. Apply adjustments (delta = new - old)
      // Actually, since we are only deducting for NEW invoices, we don't need to "add back old" in the same way.
      // If we are updating an existing job card that already has an invoice, we do nothing to stock.
      // If we are updating an existing job card that does NOT have an invoice (user deleted it), we deduct the NEW quantities.
      for (const entry of Array.from(adjustments.entries())) {
        const ppfId = entry[0];
        const ppfAdjustments = entry[1];
        const ppfMaster = await PPFMasterModel.findById(ppfId);
        if (ppfMaster && ppfMaster.rolls) {
          let modified = false;
          for (const adjEntry of Array.from(ppfAdjustments.entries())) {
            const rollId = adjEntry[0];
            const delta = adjEntry[1];
            if (delta === 0) continue;
            const roll = (ppfMaster.rolls as any[]).find(r => 
              (r._id && r._id.toString() === rollId) || r.id === rollId
            );
            if (roll) {
              roll.stock = Math.max(0, (roll.stock || 0) - delta);
              modified = true;
              console.log(`Deducted ${delta} sqft from roll ${roll.name} during JobCard update (new invoice will be created). Remaining: ${roll.stock}`);
            }
          }
          if (modified) {
            ppfMaster.markModified("rolls");
            await ppfMaster.save();
          }
        }
      }
    }

    const j = await JobCardModel.findByIdAndUpdate(id, jobCard, { new: true });
    if (!j) return undefined;

    // Update associated invoices with new labor charge, discount, and GST
    const year = new Date().getFullYear();
    const businesses = ["Auto Gamma", "AGNX"] as const;
    
    for (const biz of businesses) {
      const bizItems: any[] = [];
      let bizLaborCharge = 0;

      // Fetch existing invoice first so we can use its hsnCode as a fallback
      const existingInvoice = await InvoiceModel.findOne({ jobCardId: id, business: biz });

      // Build a hsnCode fallback map from the existing invoice items (keyed by item name)
      const existingInvoiceHsnMap = new Map<string, string>();
      if (existingInvoice?.items) {
        (existingInvoice.items as any[]).forEach((item: any) => {
          if (item.hsnCode && item.name) {
            existingInvoiceHsnMap.set(item.name, item.hsnCode);
            // Also key by type+category for accessories and ppfs
            if (item.category) existingInvoiceHsnMap.set(`${item.type}_${item.category}`, item.hsnCode);
          }
        });
      }
      
      // Services
      j.services?.forEach(s => {
        if ((s as any).business === biz) {
          const hsnCode = (s as any).hsnCode || existingInvoiceHsnMap.get(s.name) || "";
          bizItems.push({ 
            name: s.name, 
            price: s.price, 
            type: "Service",
            technician: (s as any).technician,
            vehicleType: (j as any).vehicleType,
            warranty: (s as any).warranty || undefined,
            hsnCode
          });
        }
      });
      
      // PPFs with detailed info
      j.ppfs?.forEach(p => {
        if ((p as any).business === biz) {
          const ppfCategory = (p as any).ppfId || p.id;
          const hsnCode = (p as any).hsnCode || existingInvoiceHsnMap.get(`PPF_${ppfCategory}`) || existingInvoiceHsnMap.get(p.name) || "";
          bizItems.push({ 
            name: p.name, 
            price: p.price, 
            type: "PPF",
            warranty: (p as any).warranty || (p as any).warrantyName,
            vehicleType: (j as any).vehicleType,
            rollUsed: (p as any).rollUsed,
            technician: (p as any).technician,
            category: ppfCategory,
            hsnCode
          });
        }
      });
      
      // Accessories with category
      if (j.accessories) {
        for (const a of j.accessories) {
          if ((a as any).business === biz) {
            const accCategory = (a as any).category || "";
            const hsnCode = (a as any).hsnCode || existingInvoiceHsnMap.get(`Accessory_${accCategory}`) || existingInvoiceHsnMap.get(a.name) || "";
            bizItems.push({ 
              name: a.name, 
              price: a.price, 
              quantity: (a as any).quantity || 1, 
              type: "Accessory",
              category: accCategory,
              hsnCode
            });
          }
        }
      }
      
      // Labor - tracked separately
      if ((j as any).laborBusiness === biz && j.laborCharge > 0) {
        bizLaborCharge = j.laborCharge;
        bizItems.push({ name: "Labor Charge", price: j.laborCharge, type: "Labor" });
      }
      
      if (bizItems.length > 0) {
        const itemsSubtotal = bizItems.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0);
        
        let discountAmount = 0;
        const autoGammaDiscount = (j as any).autoGammaDiscount || 0;
        const agnxDiscount = (j as any).agnxDiscount || 0;
        const totalDiscount = j.discount || 0;

        const bizCount = [
          ...(j.services || []), 
          ...(j.ppfs || []), 
          ...(j.accessories || [])
        ].reduce((acc, item) => acc.add((item as any).business), new Set<string>()).size;

        if (biz === "Auto Gamma") {
          discountAmount = autoGammaDiscount || (bizCount === 1 ? totalDiscount : 0);
        } else {
          discountAmount = agnxDiscount || (bizCount === 1 ? totalDiscount : 0);
        }

        const subtotalAfterDiscount = itemsSubtotal - discountAmount;
        const gstRate = Number(j.gst ?? 0);
        
        const { gstAmount, totalAmount } = calculateGstAmounts(
          subtotalAfterDiscount,
          gstRate,
          (j as any).gstMode,
        );
        const invoiceTotalAmount = Math.max(0, Math.round(totalAmount));
        
        if (existingInvoice) {
          // EXCEPTION - Logic for deducting incremental roll quantities when updating job card
          const oldItems = existingInvoice.items || [];
          const newItems = bizItems;

          // Group old rolls for comparison
          const oldRollMap = new Map<string, number>();
          oldItems.forEach(item => {
            if (item.type === "PPF") {
              const key = `${item.category}_${item.name}`;
              oldRollMap.set(key, (oldRollMap.get(key) || 0) + (item.rollUsed || 0));
            }
          });

          // Calculate total roll used for the updated invoice items
          for (const newItem of newItems) {
            if (newItem.type === "PPF") {
              const newItemName = newItem.name || "";
              const rollMatches = Array.from(newItemName.matchAll(/(?:Quantity:\s*)?([\d.]+)sqft\s*\(from\s*(.*?)\)/g));
              
              let totalRollUsedForItem = 0;
              for (const match of rollMatches) {
                const typedMatch = match as RegExpMatchArray;
                const qty = parseFloat(typedMatch[1]);
                totalRollUsedForItem += qty;

                const rollName = typedMatch[2].split(/[,\s)]/)[0].trim();
                
                // Construct a unique key for this specific roll under this PPF category
                const key = `${newItem.category}_${rollName}`;
                
                // Calculate total old quantity for this specific roll from existing invoice
                let oldQty = 0;
                oldItems.forEach(oldItem => {
                  if (oldItem.type === "PPF" && oldItem.category === newItem.category) {
                    const oldItemName = oldItem.name || "";
                    const oldMatches = Array.from(oldItemName.matchAll(/(?:Quantity:\s*)?([\d.]+)sqft\s*\(from\s*(.*?)\)/g));
                    oldMatches.forEach(oldMatch => {
                      if (oldMatch[2].split(/[,\s)]/)[0].trim() === rollName) {
                        oldQty += parseFloat(oldMatch[1]);
                      }
                    });
                  }
                });

                // Only deduct if new quantity is greater than old quantity
                if (qty > oldQty) {
                  const deductQty = qty - oldQty;
                  const ppfId = (newItem as any).category;
                  if (ppfId && mongoose.Types.ObjectId.isValid(ppfId)) {
                    const ppfMaster = await PPFMasterModel.findById(ppfId);
                    if (ppfMaster && ppfMaster.rolls) {
                      const roll = (ppfMaster.rolls as any[]).find(r => 
                        r.name === rollName || (r.name && rollName && r.name.toLowerCase().includes(rollName.toLowerCase()))
                      );

                      if (roll) {
                        roll.stock = Math.max(0, (roll.stock || 0) - deductQty);
                        ppfMaster.markModified("rolls");
                        await ppfMaster.save();
                        console.log(`[JOB CARD UPDATE EXCEPTION] Deducted incremental ${deductQty} sqft from roll ${roll.name} (Old: ${oldQty}, New: ${qty}). Remaining: ${roll.stock}`);
                      }
                    }
                  }
                }
              }
              // Update the item's rollUsed field with the sum of all rolls
              newItem.rollUsed = totalRollUsedForItem;
            }
          }

          // Per-business payments take priority; fall back to single-business global payments
          const perBizPayUpdate = (jobCard as any).perBusinessPayments?.[biz];
          let invoicePaymentsUpdate: any[] = [];
          let invoiceIsPaidUpdate = false;
          if (perBizPayUpdate !== undefined) {
            const amt = Number(perBizPayUpdate.amount) || 0;
            if (amt > 0) {
              invoicePaymentsUpdate = [{ amount: amt, method: perBizPayUpdate.method || "Cash", date: perBizPayUpdate.date || new Date().toISOString().split("T")[0] }];
            }
             invoiceIsPaidUpdate = amt >= invoiceTotalAmount;
          } else {
            const jobPaymentsUpdate: any[] = (jobCard as any).payments || [];
            if ((jobCard as any).isPaid && jobPaymentsUpdate.length > 0) {
              invoicePaymentsUpdate = jobPaymentsUpdate;
              invoiceIsPaidUpdate = true;
            } else {
              // Preserve existing invoice payments — don't wipe them when editing a job card without changing payments
              invoicePaymentsUpdate = (existingInvoice.payments || []) as any[];
              const existingPaid = invoicePaymentsUpdate.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
               invoiceIsPaidUpdate =
                 existingPaid > 0 && existingPaid >= invoiceTotalAmount;
            }
          }

          // Update existing invoice
          await InvoiceModel.findByIdAndUpdate(existingInvoice._id, {
            customerName: j.customerName,
            phoneNumber: j.phoneNumber,
            emailAddress: j.emailAddress,
            vehicleInfo: `${j.year || "NA"} ${j.make} ${j.model}`,
            vehicleMake: j.make,
            vehicleModel: j.model,
            vehicleYear: j.year || "NA",
            licensePlate: j.licensePlate,
            vehicleType: (j as any).vehicleType,
            items: bizItems,
            subtotal: itemsSubtotal,
            discount: discountAmount,
            laborCharge: bizLaborCharge,
            gstPercentage: j.gst,
            gstMode: (j as any).gstMode || "exclusive",
            gstAmount,
             totalAmount: invoiceTotalAmount,
            date: j.date,
            isPaid: invoiceIsPaidUpdate,
            payments: invoicePaymentsUpdate
          });
        } else {
          // Deduct PPF roll stock before creating the first invoice for this business
          for (const ppfItem of bizItems) {
            if (ppfItem.type === "PPF") {
              const ppfId = (ppfItem as any).category;
              let ppfMaster = null;

              if (ppfId && mongoose.Types.ObjectId.isValid(ppfId)) {
                ppfMaster = await PPFMasterModel.findById(ppfId);
              }

              if (!ppfMaster && ppfItem.name) {
                const ppfName = ppfItem.name.split('(')[0].split('\n')[0].trim();
                ppfMaster = await PPFMasterModel.findOne({
                  name: { $regex: new RegExp(`^${ppfName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
                });
              }

              if (ppfMaster && ppfMaster.rolls) {
                let deducted = false;
                let totalRollUsedForItem = 0;
                
                if (ppfItem.name) {
                  // Fallback: Parse from name if no explicit roll data
                  const rollMatches = Array.from((ppfItem.name || "").matchAll(/(?:Quantity:\s*)?([\d.]+)sqft\s*\(from\s*(.*?)\)/g));
                  for (const match of rollMatches) {
                    const typedMatch = match as RegExpMatchArray;
                    const qty = parseFloat(typedMatch[1]);
                    totalRollUsedForItem += qty;
                    const rawRollName = typedMatch[2].split(/[,\s)]/)[0].trim();
                    const roll = (ppfMaster.rolls as any[]).find(r =>
                      r.name === rawRollName ||
                      (r.name && r.name.toLowerCase().includes(rawRollName.toLowerCase())) ||
                      (rawRollName.toLowerCase().includes(r.name.toLowerCase()))
                    );
                    if (roll && !isNaN(qty)) {
                      roll.stock = Math.max(0, (roll.stock || 0) - qty);
                      deducted = true;
                      console.log(`Deducted ${qty} sqft from roll ${roll.name} for JobCard update (Parsed from name). Remaining: ${roll.stock}`);
                    }
                  }
                  // Update the item's rollUsed field
                  ppfItem.rollUsed = totalRollUsedForItem;
                }

                if (deducted) {
                  ppfMaster.markModified("rolls");
                  await ppfMaster.save();
                }
              }
            }
          }

          // Create new invoice if it doesn't exist
          const bizPrefix = biz === "Auto Gamma" ? "AG" : "AGNX";
          const updateMonthStr = (j.date ? new Date(j.date) : new Date()).toISOString().slice(0, 7); // YYYY-MM
          const lastInvoiceUpdate = await InvoiceModel.findOne({
            invoiceNo: { $regex: `^${bizPrefix}-${updateMonthStr}-\\d{3}$` }
          }).sort({ invoiceNo: -1 });
          let nextNumUpdate = 1;
          if (lastInvoiceUpdate) {
            const parts = lastInvoiceUpdate.invoiceNo.split("-");
            const lastNum = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastNum)) nextNumUpdate = lastNum + 1;
          }
          const invoiceNo = `${bizPrefix}-${updateMonthStr}-${nextNumUpdate.toString().padStart(3, "0")}`;

          // Per-business payments take priority; fall back to single-business global payments
          const perBizPayNew = (jobCard as any).perBusinessPayments?.[biz];
          let invoicePaymentsNew: any[] = [];
          let invoiceIsPaidNew = false;
          if (perBizPayNew !== undefined) {
            const amt = Number(perBizPayNew.amount) || 0;
            if (amt > 0) {
              invoicePaymentsNew = [{ amount: amt, method: perBizPayNew.method || "Cash", date: perBizPayNew.date || new Date().toISOString().split("T")[0] }];
            }
            invoiceIsPaidNew = amt >= invoiceTotalAmount;
          } else {
            const jobPaymentsNew: any[] = (jobCard as any).payments || [];
            if ((jobCard as any).isPaid && jobPaymentsNew.length > 0) {
              invoicePaymentsNew = jobPaymentsNew;
              invoiceIsPaidNew = true;
            }
          }
          
          const inv = new InvoiceModel({
            invoiceNo,
            jobCardId: id,
            business: biz,
            customerName: j.customerName,
            phoneNumber: j.phoneNumber,
            emailAddress: j.emailAddress,
            vehicleInfo: `${j.year || "NA"} ${j.make} ${j.model}`,
            vehicleMake: j.make,
            vehicleModel: j.model,
            vehicleYear: j.year || "NA",
            licensePlate: j.licensePlate,
            vehicleType: (j as any).vehicleType,
            items: bizItems,
            subtotal: itemsSubtotal,
            discount: discountAmount,
            laborCharge: bizLaborCharge,
            gstPercentage: j.gst,
            gstMode: (j as any).gstMode || "exclusive",
            gstAmount,
             totalAmount: invoiceTotalAmount,
            date: j.date,
            isPaid: invoiceIsPaidNew,
            payments: invoicePaymentsNew
          });
          await inv.save();
        }
      } else if (existingInvoice) {
        // Remove invoice if no items for this business anymore
        await InvoiceModel.findByIdAndDelete(existingInvoice._id);
      }
    }

    const updatedInvoices = await InvoiceModel.find(
      { jobCardId: id },
      { invoiceNo: 1, business: 1 },
    ).lean();
    const invoiceNumbersByBusiness = updatedInvoices.reduce(
      (result: Record<string, string>, invoice: any) => {
        if (invoice.business && invoice.invoiceNo) {
          result[invoice.business] = invoice.invoiceNo;
        }
        return result;
      },
      {},
    );

    return {
      ...j.toObject(),
      id: j._id.toString(),
      services: j.services || [],
      ppfs: j.ppfs || [],
      accessories: j.accessories || [],
      vehicleType: (j as any).vehicleType,
      invoiceNumbers: updatedInvoices.map((invoice: any) => invoice.invoiceNo),
      invoiceNumbersByBusiness,
    } as JobCard;
  }

  async deleteJobCard(id: string): Promise<boolean> {
    const result = await JobCardModel.findByIdAndDelete(id);
    return !!result;
  }

  // Inquiries
  async getInquiries(): Promise<Inquiry[]> {
    const inquiries = await InquiryModel.find().sort({ date: -1 });
    return inquiries.map(i => ({
      id: i._id.toString(),
      inquiryId: (i as any).inquiryId,
      customerName: i.customerName,
      phone: i.phone,
      email: i.email || undefined,
      services: (i as any).services || [],
      accessories: (i as any).accessories || [],
      notes: i.notes || undefined,
      ourPrice: (i as any).ourPrice || 0,
      customerPrice: (i as any).customerPrice || 0,
      status: (i as any).status as any,
      priority: (i as any).priority || "MEDIUM",
      isConverted: (i as any).isConverted || false,
      createdAt: (i as any).createdAt || (i as any).date 
    })) as Inquiry[];
  }

  async createInquiry(inquiry: InsertInquiry): Promise<Inquiry> {
    const nextInquiryId = `INQ-${Date.now()}`;
    const i = new InquiryModel({
      ...inquiry,
      inquiryId: nextInquiryId,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isConverted: false
    });
    await i.save();
    return {
      id: i._id.toString(),
      inquiryId: (i as any).inquiryId,
      customerName: i.customerName,
      phone: i.phone,
      email: i.email || undefined,
      services: i.services as any,
      accessories: i.accessories as any,
      notes: i.notes || undefined,
      ourPrice: (i as any).ourPrice || 0,
      customerPrice: (i as any).customerPrice || 0,
      status: (i as any).status as any,
      priority: (i as any).priority || "MEDIUM",
      isConverted: false,
      createdAt: (i as any).createdAt || (i as any).date
    };
  }

  async updateInquiry(id: string, inquiry: Partial<Inquiry>): Promise<Inquiry | undefined> {
    const i = await InquiryModel.findByIdAndUpdate(id, inquiry, { new: true });
    if (!i) return undefined;
    return {
      id: i._id.toString(),
      inquiryId: (i as any).inquiryId,
      customerName: i.customerName,
      phone: i.phone,
      email: i.email || undefined,
      services: (i as any).services as any,
      accessories: (i as any).accessories as any,
      notes: i.notes || undefined,
      ourPrice: (i as any).ourPrice || 0,
      customerPrice: (i as any).customerPrice || 0,
      status: (i as any).status as any,
      priority: (i as any).priority || "MEDIUM",
      isConverted: (i as any).isConverted || false,
      createdAt: (i as any).createdAt || (i as any).date
    };
  }

  async deleteInquiry(id: string): Promise<boolean> {
    const result = await InquiryModel.findByIdAndDelete(id);
    return !!result;
  }

  async getInquiriesByPhone(phone: string): Promise<Inquiry[]> {
    const inquiries = await InquiryModel.find({ phone }).sort({ date: -1 });
    return inquiries.map(i => ({
      id: i._id.toString(),
      inquiryId: (i as any).inquiryId,
      customerName: i.customerName,
      phone: i.phone,
      email: i.email || undefined,
      services: (i as any).services || [],
      accessories: (i as any).accessories || [],
      notes: i.notes || undefined,
      ourPrice: (i as any).ourPrice || 0,
      customerPrice: (i as any).customerPrice || 0,
      status: (i as any).status as any,
      isConverted: (i as any).isConverted || false,
      createdAt: (i as any).createdAt || (i as any).date 
    })) as Inquiry[];
  }

  // Tickets
  async getTickets(): Promise<any[]> {
    const tickets = await TicketModel.find();
    return tickets.map(t => ({
      id: t._id.toString(),
      customerId: t.customerId,
      customerName: t.customerName,
      phone: t.phone || "",
      note: t.note,
      createdAt: t.createdAt
    }));
  }

  async createTicket(ticket: any): Promise<any> {
    const t = new TicketModel({
      ...ticket,
      createdAt: new Date().toISOString()
    });
    await t.save();
    return {
      id: t._id.toString(),
      customerId: t.customerId,
      customerName: t.customerName,
      phone: t.phone || "",
      note: t.note,
      createdAt: t.createdAt
    };
  }

  async updateTicket(id: string, ticket: any): Promise<any | undefined> {
    const t = await TicketModel.findByIdAndUpdate(id, ticket, { new: true });
    if (!t) return undefined;
    return {
      id: t._id.toString(),
      customerId: t.customerId,
      customerName: t.customerName,
      phone: t.phone || "",
      note: t.note,
      createdAt: t.createdAt
    };
  }

  async deleteTicket(id: string): Promise<boolean> {
    const result = await TicketModel.findByIdAndDelete(id);
    return !!result;
  }

  async getInvoices(): Promise<Invoice[]> {
    const invoices = await InvoiceModel.find().sort({ _id: -1 });
    const allCategories = await AccessoryCategoryModel.find();
    const categoryIdToName = new Map(allCategories.map(c => [c._id.toString(), c.name]));
    const allAccessoryMasters = await AccessoryMasterModel.find();
    const accessoryIdToCategory = new Map(allAccessoryMasters.map(a => [a._id.toString(), a.category]));
    const enrichedInvoices: Invoice[] = [];
    
    for (const inv of invoices) {
      const obj = inv.toObject();
      let enrichedInvoice: any = {
        ...obj,
        id: inv._id.toString(),
        business: inv.business as "Auto Gamma" | "AGNX",
        discount: obj.discount ?? 0,
        laborCharge: obj.laborCharge ?? 0,
        gstPercentage: obj.gstPercentage ?? 18,
        gstMode: obj.gstMode ?? "exclusive",
        isPaid: obj.isPaid ?? false,
        paymentMethod: obj.paymentMethod,
        paymentDate: obj.paymentDate,
      };
      
      // Enrich with job card data if vehicle details are missing
      if (inv.jobCardId && (!inv.vehicleMake || !inv.licensePlate)) {
        try {
          const jobCard = await JobCardModel.findById(inv.jobCardId);
          if (jobCard) {
            enrichedInvoice.vehicleMake = enrichedInvoice.vehicleMake || jobCard.make;
            enrichedInvoice.vehicleModel = enrichedInvoice.vehicleModel || jobCard.model;
            enrichedInvoice.vehicleYear = enrichedInvoice.vehicleYear || jobCard.year || "NA";
            enrichedInvoice.licensePlate = enrichedInvoice.licensePlate || jobCard.licensePlate;
            enrichedInvoice.vehicleType = enrichedInvoice.vehicleType || jobCard.vehicleType;
            
            // Enrich items with sub-details from job card
            if (enrichedInvoice.items && enrichedInvoice.items.length > 0) {
              enrichedInvoice.items = enrichedInvoice.items.map((item: any) => {
                // PPF items - match by name and enrich with warranty, rollUsed
                if (item.type === "PPF" && jobCard.ppfs) {
                  const matchingPpf = (jobCard.ppfs as any[]).find(p => p.name === item.name);
                  if (matchingPpf) {
                    return {
                      ...item,
                      warranty: item.warranty || matchingPpf.warranty || matchingPpf.warrantyName,
                      rollUsed: item.rollUsed || matchingPpf.rollUsed,
                      vehicleType: item.vehicleType || jobCard.vehicleType,
                      technician: item.technician || matchingPpf.technician,
                    };
                  }
                }
                // Service items
                if (item.type === "Service" && jobCard.services) {
                  const matchingService = (jobCard.services as any[]).find(s => s.name === item.name);
                  if (matchingService) {
                    return {
                      ...item,
                      vehicleType: item.vehicleType || jobCard.vehicleType,
                      technician: item.technician || matchingService.technician,
                    };
                  }
                }
                // Accessory items - resolve ObjectId category to name
                if (item.type === "Accessory") {
                  let resolvedCategory = item.category || "";
                  if (resolvedCategory && mongoose.Types.ObjectId.isValid(resolvedCategory)) {
                    resolvedCategory = categoryIdToName.get(resolvedCategory) || accessoryIdToCategory.get(resolvedCategory) || resolvedCategory;
                  }
                  if (resolvedCategory && mongoose.Types.ObjectId.isValid(resolvedCategory)) {
                    resolvedCategory = categoryIdToName.get(resolvedCategory) || resolvedCategory;
                  }
                  if (jobCard.accessories) {
                    const matchingAccessory = (jobCard.accessories as any[]).find(a => a.name === item.name);
                    if (matchingAccessory) {
                      let accCategory = (matchingAccessory.category || "");
                      if (accCategory && mongoose.Types.ObjectId.isValid(accCategory)) {
                        accCategory = categoryIdToName.get(accCategory) || accCategory;
                      }
                      resolvedCategory = resolvedCategory && !mongoose.Types.ObjectId.isValid(resolvedCategory)
                        ? resolvedCategory
                        : (accCategory || resolvedCategory);
                      return {
                        ...item,
                        category: resolvedCategory,
                        quantity: item.quantity || matchingAccessory.quantity || 1,
                      };
                    }
                  }
                  return { ...item, category: resolvedCategory };
                }
                return item;
              });
            }
          }
        } catch (e) {
          console.error("Error enriching invoice with job card data:", e);
        }
      }
      
      // Final pass: resolve any remaining ObjectId categories on accessory items
      if (enrichedInvoice.items && enrichedInvoice.items.length > 0) {
        enrichedInvoice.items = enrichedInvoice.items.map((item: any) => {
          if (item.type === "Accessory" && item.category && mongoose.Types.ObjectId.isValid(item.category)) {
            const resolved = categoryIdToName.get(item.category) || accessoryIdToCategory.get(item.category) || item.category;
            return { ...item, category: mongoose.Types.ObjectId.isValid(resolved) ? "" : resolved };
          }
          return item;
        });
      }

      enrichedInvoices.push(enrichedInvoice as Invoice);
    }
    
    return enrichedInvoices;
  }

  async getInvoicesByPhone(phone: string): Promise<Invoice[]> {
    const invoices = await InvoiceModel.find({ phoneNumber: phone }).sort({ date: -1 });
    const allCategories = await AccessoryCategoryModel.find();
    const categoryIdToName = new Map(allCategories.map(c => [c._id.toString(), c.name]));
    const allAccessoryMasters = await AccessoryMasterModel.find();
    const accessoryIdToCategory = new Map(allAccessoryMasters.map(a => [a._id.toString(), a.category]));
    const enrichedInvoices: Invoice[] = [];
    
    for (const inv of invoices) {
      const obj = inv.toObject();
      let enrichedInvoice: any = {
        ...obj,
        id: inv._id.toString(),
        business: inv.business as "Auto Gamma" | "AGNX",
        discount: obj.discount ?? 0,
        laborCharge: obj.laborCharge ?? 0,
        gstPercentage: obj.gstPercentage ?? 18,
        gstMode: obj.gstMode ?? "exclusive",
      };
      
      // Enrich with job card data if vehicle details are missing
      if (inv.jobCardId && (!inv.vehicleMake || !inv.licensePlate)) {
        try {
          const jobCard = await JobCardModel.findById(inv.jobCardId);
          if (jobCard) {
            enrichedInvoice.vehicleMake = enrichedInvoice.vehicleMake || jobCard.make;
            enrichedInvoice.vehicleModel = enrichedInvoice.vehicleModel || jobCard.model;
            enrichedInvoice.vehicleYear = enrichedInvoice.vehicleYear || jobCard.year || "NA";
            enrichedInvoice.licensePlate = enrichedInvoice.licensePlate || jobCard.licensePlate;
            enrichedInvoice.vehicleType = enrichedInvoice.vehicleType || jobCard.vehicleType;
            
            // Enrich items with sub-details
            if (enrichedInvoice.items && enrichedInvoice.items.length > 0) {
              enrichedInvoice.items = enrichedInvoice.items.map((item: any) => {
                if (item.type === "PPF" && jobCard.ppfs) {
                  const matchingPpf = (jobCard.ppfs as any[]).find(p => p.name === item.name);
                  if (matchingPpf) {
                    return {
                      ...item,
                      warranty: item.warranty || matchingPpf.warranty || matchingPpf.warrantyName,
                      rollUsed: item.rollUsed || matchingPpf.rollUsed,
                      vehicleType: item.vehicleType || jobCard.vehicleType,
                      technician: item.technician || matchingPpf.technician,
                    };
                  }
                }
                if (item.type === "Service" && jobCard.services) {
                  const matchingService = (jobCard.services as any[]).find(s => s.name === item.name);
                  if (matchingService) {
                    return {
                      ...item,
                      vehicleType: item.vehicleType || jobCard.vehicleType,
                      technician: item.technician || matchingService.technician,
                    };
                  }
                }
                if (item.type === "Accessory") {
                  let resolvedCategory = item.category || "";
                  if (resolvedCategory && mongoose.Types.ObjectId.isValid(resolvedCategory)) {
                    resolvedCategory = categoryIdToName.get(resolvedCategory) || accessoryIdToCategory.get(resolvedCategory) || resolvedCategory;
                  }
                  if (jobCard.accessories) {
                    const matchingAccessory = (jobCard.accessories as any[]).find(a => a.name === item.name);
                    if (matchingAccessory) {
                      let accCategory = matchingAccessory.category || "";
                      if (accCategory && mongoose.Types.ObjectId.isValid(accCategory)) {
                        accCategory = categoryIdToName.get(accCategory) || accCategory;
                      }
                      resolvedCategory = resolvedCategory && !mongoose.Types.ObjectId.isValid(resolvedCategory)
                        ? resolvedCategory
                        : (accCategory || resolvedCategory);
                      return {
                        ...item,
                        category: resolvedCategory,
                        quantity: item.quantity || matchingAccessory.quantity || 1,
                      };
                    }
                  }
                  return { ...item, category: resolvedCategory };
                }
                return item;
              });
            }
          }
        } catch (e) {
          console.error("Error enriching invoice with job card data:", e);
        }
      }

      // Final pass: resolve any remaining ObjectId categories on accessory items
      if (enrichedInvoice.items && enrichedInvoice.items.length > 0) {
        enrichedInvoice.items = enrichedInvoice.items.map((item: any) => {
          if (item.type === "Accessory" && item.category && mongoose.Types.ObjectId.isValid(item.category)) {
            const resolved = categoryIdToName.get(item.category) || accessoryIdToCategory.get(item.category) || item.category;
            return { ...item, category: mongoose.Types.ObjectId.isValid(resolved) ? "" : resolved };
          }
          return item;
        });
      }
      
      enrichedInvoices.push(enrichedInvoice as Invoice);
    }
    
    return enrichedInvoices;
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const inv = await InvoiceModel.findById(id);
    if (!inv) return undefined;
    const obj = inv.toObject();
    return {
      ...obj,
      id: inv._id.toString(),
      items: (inv as any).items || [],
      discount: obj.discount ?? 0,
      laborCharge: obj.laborCharge ?? 0,
      gstPercentage: obj.gstPercentage ?? 18,
      gstMode: obj.gstMode ?? "exclusive",
      isPaid: obj.isPaid ?? false,
      paymentMethod: obj.paymentMethod,
      paymentDate: obj.paymentDate,
    } as Invoice;
  }

  async createInvoice(invoice: any): Promise<Invoice> {
    const inv = new InvoiceModel(invoice);
    await inv.save();
    const obj = inv.toObject();
    return {
      ...obj,
      id: inv._id.toString(),
      items: (inv as any).items || [],
      discount: obj.discount ?? 0,
      laborCharge: obj.laborCharge ?? 0,
      gstPercentage: obj.gstPercentage ?? 18,
      gstMode: obj.gstMode ?? "exclusive",
      isPaid: obj.isPaid ?? false,
      paymentMethod: obj.paymentMethod,
      paymentDate: obj.paymentDate,
    } as Invoice;
  }

  async updateInvoice(id: string, invoice: Partial<Invoice>): Promise<Invoice | undefined> {
    const existingInvoice = await InvoiceModel.findById(id);
    if (!existingInvoice) return undefined;

    // EXCEPTION - Logic for deducting incremental roll quantities
    if (invoice.items) {
      const oldItems = existingInvoice.items || [];
      const newItems = invoice.items;

      for (const newItem of newItems) {
        if (newItem.type === "PPF") {
          const newItemName = newItem.name || "";
          const rollMatches = Array.from(newItemName.matchAll(/(?:Quantity:\s*)?([\d.]+)sqft\s*\(from\s*(.*?)\)/g));
          
          let totalRollUsedForItem = 0;
          for (const match of rollMatches) {
            const typedMatch = match as RegExpMatchArray;
            const qty = parseFloat(typedMatch[1]);
            totalRollUsedForItem += qty;

            const rollName = typedMatch[2].split(/[,\s)]/)[0].trim();
            
            // Calculate total old quantity for this specific roll from existing invoice
            let oldQty = 0;
            oldItems.forEach(oldItem => {
              if (oldItem.type === "PPF" && oldItem.category === newItem.category) {
                const oldItemName = oldItem.name || "";
                const oldMatches = Array.from(oldItemName.matchAll(/(?:Quantity:\s*)?([\d.]+)sqft\s*\(from\s*(.*?)\)/g));
                oldMatches.forEach(oldMatch => {
                  if (oldMatch[2].split(/[,\s)]/)[0].trim() === rollName) {
                    oldQty += parseFloat(oldMatch[1]);
                  }
                });
              }
            });

            // Only deduct if new quantity is greater than old quantity
            if (qty > oldQty) {
              const deductQty = qty - oldQty;
              const ppfId = newItem.category;
              if (ppfId && mongoose.Types.ObjectId.isValid(ppfId)) {
                const ppfMaster = await PPFMasterModel.findById(ppfId);
                if (ppfMaster && ppfMaster.rolls) {
                  const roll = (ppfMaster.rolls as any[]).find(r => 
                    r.name === rollName || (r.name && rollName && r.name.toLowerCase().includes(rollName.toLowerCase()))
                  );

                  if (roll) {
                    roll.stock = Math.max(0, (roll.stock || 0) - deductQty);
                    ppfMaster.markModified("rolls");
                    await ppfMaster.save();
                    console.log(`[INVOICE UPDATE EXCEPTION] Deducted incremental ${deductQty} sqft from roll ${roll.name} (Old: ${oldQty}, New: ${qty}). Remaining: ${roll.stock}`);
                  }
                }
              }
            }
          }
          // Update the item's rollUsed field with the sum of all rolls
          newItem.rollUsed = totalRollUsedForItem;
        }
      }
    }

    const inv = await InvoiceModel.findByIdAndUpdate(id, invoice, { new: true });
    if (!inv) return undefined;
    const obj = inv.toObject();
    return {
      ...obj,
      id: inv._id.toString(),
      items: (inv as any).items || [],
      discount: obj.discount ?? 0,
      laborCharge: obj.laborCharge ?? 0,
      gstPercentage: obj.gstPercentage ?? 18,
      gstMode: obj.gstMode ?? "exclusive",
      isPaid: obj.isPaid ?? false,
      paymentMethod: obj.paymentMethod,
      paymentDate: obj.paymentDate,
    } as Invoice;
  }

  async deleteInvoice(id: string): Promise<boolean> {
    try {
      const invoice = await InvoiceModel.findById(id);
      if (!invoice) {
        console.log(`[STORAGE DELETE INVOICE] Invoice not found: ${id}`);
        return false;
      }

      console.log(`[STORAGE DELETE INVOICE] Found invoice: ${invoice.invoiceNo}, jobCardId: ${invoice.jobCardId}`);

      // Replenish PPF stock if there are PPF items
      if (invoice.items && invoice.items.length > 0) {
        // Try to find the original Job Card to get exact roll used data
        const jobCard = invoice.jobCardId ? await JobCardModel.findById(invoice.jobCardId) : null;

        for (const item of invoice.items) {
          if (item.type === "PPF") {
            console.log(`[REPLENISH] Processing PPF item: ${item.name}`);
            
            let ppfMaster = null;
            // Try by category ID first (newly created invoices)
            if (item.category && mongoose.Types.ObjectId.isValid(item.category)) {
              ppfMaster = await PPFMasterModel.findById(item.category);
            }
            
            // Fallback: Try by name
            if (!ppfMaster && item.name) {
              const ppfName = item.name.split('(')[0].split('\n')[0].trim();
              ppfMaster = await PPFMasterModel.findOne({ 
                name: { $regex: new RegExp(`^${ppfName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
              });
            }

            if (ppfMaster && ppfMaster.rolls) {
              let replenished = false;

              // Priority 1: Use exact roll data from Job Card if available
              if (jobCard && jobCard.ppfs) {
                const matchingPpf = (jobCard.ppfs as any[]).find(p => p.name === item.name || (p.ppfId || p.id) === item.category);
                if (matchingPpf) {
                  const rollsToRevert = (matchingPpf as any).rollsUsed || (matchingPpf.rollId ? [{
                    rollId: matchingPpf.rollId,
                    rollUsed: (matchingPpf as any).rollUsed || 0
                  }] : []);

                  for (const entry of rollsToRevert) {
                    const roll = (ppfMaster.rolls as any[]).find(r => 
                      (r._id && r._id.toString() === entry.rollId) || r.id === entry.rollId
                    );
                    if (roll && entry.rollUsed > 0) {
                      roll.stock += entry.rollUsed;
                      replenished = true;
                      console.log(`[REPLENISH] Added ${entry.rollUsed} to ${roll.name} from Job Card data`);
                    }
                  }
                }
              }

              // Priority 2: Fallback to parsing from item name if Job Card data wasn't found or didn't match
              if (!replenished) {
                const rollMatches = Array.from((item.name || "").matchAll(/(?:Quantity:\s*)?([\d.]+)sqft\s*\(from\s*(.*?)\)/g));
                if (rollMatches.length > 0) {
                  for (const match of rollMatches) {
                    const qty = parseFloat(match[1]);
                    const rawRollName = match[2].split(/[,\s)]/)[0].trim();
                    
                    const roll = (ppfMaster.rolls as any[]).find(r => 
                      r.name === rawRollName || 
                      (r.name && r.name.toLowerCase().includes(rawRollName.toLowerCase())) ||
                      (rawRollName.toLowerCase().includes(r.name.toLowerCase()))
                    );

                    if (roll && !isNaN(qty)) {
                      roll.stock += qty;
                      replenished = true;
                      console.log(`[REPLENISH] Added ${qty} to ${roll.name} from parsed name`);
                    }
                  }
                }
              }

              if (replenished) {
                ppfMaster.markModified("rolls");
                await ppfMaster.save();
              }
            }
          }
        }
      }

      const result = await InvoiceModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error("[STORAGE DELETE INVOICE ERROR]", error);
      throw error;
    }
  }

  // Vendor Management
  private normalizeVendor(v: any): Vendor {
    const obj = v.toObject ? v.toObject() : v;
    const cats: string[] = Array.isArray(obj.categories) && obj.categories.length > 0
      ? obj.categories
      : obj.category ? [obj.category] : [];
    return { ...obj, id: obj._id?.toString() || obj.id, categories: cats } as Vendor;
  }

  async getVendors(): Promise<Vendor[]> {
    const vendors = await VendorModel.find().sort({ createdAt: -1 });
    return vendors.map(v => this.normalizeVendor(v));
  }

  async getVendor(id: string): Promise<Vendor | undefined> {
    const v = await VendorModel.findById(id);
    if (!v) return undefined;
    return this.normalizeVendor(v);
  }

  async createVendor(vendor: InsertVendor): Promise<Vendor> {
    const v = new VendorModel({ ...vendor, createdAt: new Date().toISOString() });
    await v.save();
    return this.normalizeVendor(v);
  }

  async updateVendor(id: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined> {
    const v = await VendorModel.findByIdAndUpdate(id, vendor, { new: true });
    if (!v) return undefined;
    return this.normalizeVendor(v);
  }

  async deleteVendor(id: string): Promise<boolean> {
    const result = await VendorModel.findByIdAndDelete(id);
    return !!result;
  }

  async getVendorPurchases(vendorId?: string): Promise<VendorPurchase[]> {
    const query = vendorId ? { vendorId } : {};
    const purchases = await VendorPurchaseModel.find(query).sort({ createdAt: -1 });
    return purchases.map(p => ({ ...p.toObject(), id: p._id.toString() }) as VendorPurchase);
  }

  async getVendorPurchase(id: string): Promise<VendorPurchase | undefined> {
    const p = await VendorPurchaseModel.findById(id);
    if (!p) return undefined;
    return { ...p.toObject(), id: p._id.toString() } as VendorPurchase;
  }

  async createVendorPurchase(purchase: InsertVendorPurchase): Promise<VendorPurchase> {
    const total = purchase.items.reduce((sum, item) => {
      if ((item as any).itemType === "Accessory") return sum + (item.unitPrice || 0) * (item.quantity || 1);
      return sum + (item.unitPrice || 0);
    }, 0);
    const gstEnabled = (purchase as any).gstEnabled ?? false;
    const gstType: string = (purchase as any).gstType ?? (gstEnabled ? "external" : "none");
    const cgstPercent = (purchase as any).cgstPercent ?? 0;
    const sgstPercent = (purchase as any).sgstPercent ?? 0;
    // Internal: GST included in price; External: GST added on top
    const baseAmount = gstType === "internal" && (cgstPercent + sgstPercent) > 0
      ? total / (1 + (cgstPercent + sgstPercent) / 100)
      : total;
    const cgstAmount = gstEnabled ? (baseAmount * cgstPercent) / 100 : 0;
    const sgstAmount = gstEnabled ? (baseAmount * sgstPercent) / 100 : 0;
    const grandTotal = gstType === "external" ? total + cgstAmount + sgstAmount : total;
    const p = new VendorPurchaseModel({
      ...purchase,
      totalAmount: total,
      sellingTotal: 0,
      gstEnabled,
      gstType,
      cgstPercent,
      sgstPercent,
      cgstAmount,
      sgstAmount,
      grandTotal,
      createdAt: new Date().toISOString(),
    });
    await p.save();
    return { ...p.toObject(), id: p._id.toString() } as VendorPurchase;
  }

  async updateVendorPurchase(id: string, purchase: Partial<InsertVendorPurchase>): Promise<VendorPurchase | undefined> {
    if (purchase.items) {
      const total = purchase.items.reduce((sum, item) => {
        if ((item as any).itemType === "Accessory") return sum + (item.unitPrice || 0) * (item.quantity || 1);
        return sum + (item.unitPrice || 0);
      }, 0);
      (purchase as any).totalAmount = total;
      (purchase as any).sellingTotal = 0;
      const gstEnabled = (purchase as any).gstEnabled ?? false;
      const gstType: string = (purchase as any).gstType ?? (gstEnabled ? "external" : "none");
      const cgstPercent = (purchase as any).cgstPercent ?? 0;
      const sgstPercent = (purchase as any).sgstPercent ?? 0;
      const baseAmount = gstType === "internal" && (cgstPercent + sgstPercent) > 0
        ? total / (1 + (cgstPercent + sgstPercent) / 100)
        : total;
      const cgstAmount = gstEnabled ? (baseAmount * cgstPercent) / 100 : 0;
      const sgstAmount = gstEnabled ? (baseAmount * sgstPercent) / 100 : 0;
      (purchase as any).cgstAmount = cgstAmount;
      (purchase as any).sgstAmount = sgstAmount;
      (purchase as any).gstType = gstType;
      (purchase as any).grandTotal = gstType === "external" ? total + cgstAmount + sgstAmount : total;
    }
    const p = await VendorPurchaseModel.findByIdAndUpdate(id, purchase, { new: true });
    if (!p) return undefined;
    return { ...p.toObject(), id: p._id.toString() } as VendorPurchase;
  }

  async deleteVendorPurchase(id: string): Promise<boolean> {
    const result = await VendorPurchaseModel.findByIdAndDelete(id);
    return !!result;
  }

  // ── Warranty Follow-ups ──────────────────────────────────────────────────────
  async getWarrantyItems(): Promise<any[]> {
    const invoices = await InvoiceModel.find().lean().sort({ date: -1 });
    const items: any[] = [];
    for (const inv of invoices as any[]) {
      const invItems: any[] = inv.items || [];
      for (const item of invItems) {
        const w = item.warranty || item.warrantyPeriod || "";
        if (w && item.type !== "Accessory" && item.type !== "Labor") {
          items.push({
            invoiceId: inv._id.toString(),
            invoiceNo: inv.invoiceNo || "",
            business: inv.business || "",
            customerName: inv.customerName || "",
            customerPhone: inv.phoneNumber || "",
            vehicleInfo: `${inv.vehicleMake || ""} ${inv.vehicleModel || ""} ${inv.vehicleYear || ""}`.trim(),
            licensePlate: inv.licensePlate || "",
            invoiceDate: inv.date || "",
            itemName: item.name || "",
            itemType: item.type || "PPF",
            warrantyPeriod: w,
          });
        }
      }
    }
    return items;
  }

  async getWarrantyFollowUps(): Promise<WarrantyFollowUp[]> {
    const docs = await WarrantyFollowUpModel.find().sort({ createdAt: -1 });
    return docs.map(d => ({ ...d.toObject(), id: d._id.toString() }) as WarrantyFollowUp);
  }

  async getWarrantyFollowUp(id: string): Promise<WarrantyFollowUp | undefined> {
    const d = await WarrantyFollowUpModel.findById(id);
    if (!d) return undefined;
    return { ...d.toObject(), id: d._id.toString() } as WarrantyFollowUp;
  }

  async createWarrantyFollowUp(data: InsertWarrantyFollowUp): Promise<WarrantyFollowUp> {
    const doc = new WarrantyFollowUpModel({ ...data, createdAt: new Date().toISOString() });
    await doc.save();
    return { ...doc.toObject(), id: doc._id.toString() } as WarrantyFollowUp;
  }

  async updateWarrantyFollowUp(id: string, data: Partial<InsertWarrantyFollowUp>): Promise<WarrantyFollowUp | undefined> {
    const doc = await WarrantyFollowUpModel.findByIdAndUpdate(id, data, { new: true });
    if (!doc) return undefined;
    return { ...doc.toObject(), id: doc._id.toString() } as WarrantyFollowUp;
  }

  async deleteWarrantyFollowUp(id: string): Promise<boolean> {
    const result = await WarrantyFollowUpModel.findByIdAndDelete(id);
    return !!result;
  }

  // ── Resell Orders ────────────────────────────────────────────────────────────
  async getResellOrders(): Promise<ResellOrder[]> {
    const docs = await ResellOrderModel.find().sort({ createdAt: -1 });
    return docs.map(d => ({ ...d.toObject(), id: d._id.toString() }) as ResellOrder);
  }

  async createResellOrder(order: InsertResellOrder & { invoiceNo?: string }): Promise<ResellOrder> {
    const doc = new ResellOrderModel({ ...order, createdAt: new Date().toISOString() });
    await doc.save();
    return { ...doc.toObject(), id: doc._id.toString() } as ResellOrder;
  }

  async updateResellOrder(id: string, order: Partial<InsertResellOrder>): Promise<ResellOrder | undefined> {
    const doc = await ResellOrderModel.findByIdAndUpdate(id, { $set: order }, { new: true });
    if (!doc) return undefined;
    return { ...doc.toObject(), id: doc._id.toString() } as ResellOrder;
  }

  async deleteResellOrder(id: string): Promise<boolean> {
    const result = await ResellOrderModel.findByIdAndDelete(id);
    return !!result;
  }

  // ── WhatsApp Inquiries ────────────────────────────────────────────────────
  async getWhatsAppInquiries(): Promise<any[]> {
    const docs = await WhatsAppInquiryModel.find().sort({ createdAt: -1 });
    return docs.map(d => ({ ...d.toObject(), id: d._id.toString() }));
  }

  async getWhatsAppInquiry(id: string): Promise<any | undefined> {
    const doc = await WhatsAppInquiryModel.findById(id);
    if (!doc) return undefined;
    return { ...doc.toObject(), id: doc._id.toString() };
  }

  async createWhatsAppInquiry(data: any): Promise<any> {
    const now = new Date().toISOString();
    const doc = new WhatsAppInquiryModel({ ...data, createdAt: now, updatedAt: now });
    await doc.save();
    return { ...doc.toObject(), id: doc._id.toString() };
  }

  async updateWhatsAppInquiry(id: string, data: any): Promise<any | undefined> {
    const doc = await WhatsAppInquiryModel.findByIdAndUpdate(
      id,
      { $set: { ...data, updatedAt: new Date().toISOString() } },
      { new: true, runValidators: true },
    );
    if (!doc) return undefined;
    return { ...doc.toObject(), id: doc._id.toString() };
  }

  async deleteWhatsAppInquiry(id: string): Promise<boolean> {
    const result = await WhatsAppInquiryModel.findByIdAndDelete(id);
    return !!result;
  }
}

export const storage = new MongoStorage();
