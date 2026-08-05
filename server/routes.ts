import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, PPFMasterModel, AccessoryMasterModel, ResellOrderModel } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import { connectDB } from "./db";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";

const BUILT_IN_HSN_CODES = [
  { code: "998713", description: "PPF Installation / Ceramic Coating / Car Detailing / Paint Correction / Denting & Painting" },
  { code: "998538", description: "Car Wash / Cleaning / Interior Cleaning" },
  { code: "3919",   description: "PPF Film (Supply / Sale)" },
  { code: "3824",   description: "Ceramic Coating Liquid" },
  { code: "3405",   description: "Car Polish / Rubbing Compound" },
  { code: "3402",   description: "Car Shampoo" },
  { code: "6307",   description: "Microfiber Cloth" },
  { code: "9603",   description: "Detailing Brush" },
  { code: "87089900", description: "Seat Covers / Car Mats / Steering Cover / Body Kit / Roof Rails / Door Visor / Spoiler" },
  { code: "94049099", description: "Car Neck Cushion" },
  { code: "85198100", description: "Car Audio System / Music System" },
  { code: "852859",  description: "Android CarPlay System" },
  { code: "852580",  description: "Dash Camera" },
  { code: "8708",    description: "General Motor Vehicle Parts" },
  { code: "851810",  description: "Speaker / Subwoofer / Amplifier" },
  { code: "85122020", description: "LED Headlights / Fog Lamps / LED Light Bar" },
  { code: "94054090", description: "Ambient Light" },
  { code: "33030090", description: "Perfumes / Fragrance / Car Perfume" },
];

async function seedHsnCodes() {
  const existing = await storage.getHsnCodes();
  const existingCodes = new Set(existing.map(h => h.code));
  for (const item of BUILT_IN_HSN_CODES) {
    if (!existingCodes.has(item.code)) {
      await storage.createHsnCode(item);
    }
  }
}

/**
 * Migrates old daily-format invoice numbers (e.g. AG-2026-07-15-01)
 * to the new monthly-format (e.g. AG-2026-07-001).
 * Safe to run repeatedly — only touches invoices still in the old format.
 * Runs automatically on every server start so client VPS deployments
 * get the conversion applied without any manual step.
 */
async function migrateInvoicesToMonthlyFormat(): Promise<number> {
  if (mongoose.connection.readyState !== 1) return 0;
  const InvoiceModel = mongoose.model("Invoice");

  // Old format: AG-YYYY-MM-DD-NN (4 dashes for AG, 4 dashes for AGNX)
  // Detected by having exactly 5 segments when split on "-" for AG prefix,
  // or exactly 5 segments for AGNX prefix (AGNX-YYYY-MM-DD-NN = 5 segments)
  const oldFormatRegex = /^(AG|AGNX)-\d{4}-\d{2}-\d{2}-\d+$/;
  const allInvoices = await InvoiceModel.find().sort({ invoiceNo: 1 }) as any[];
  const oldFormatInvoices = allInvoices.filter((inv: any) => oldFormatRegex.test(inv.invoiceNo || ""));

  if (oldFormatInvoices.length === 0) return 0;

  // Group by bizPrefix + YYYY-MM (extracted from old invoice number)
  const groups = new Map<string, any[]>();
  for (const inv of oldFormatInvoices) {
    const parts = (inv.invoiceNo as string).split("-");
    // parts: ["AG","2026","07","15","01"] or ["AGNX","2026","07","15","01"]
    const prefix = parts[0]; // AG or AGNX
    const monthStr = `${parts[1]}-${parts[2]}`; // YYYY-MM
    const key = `${prefix}:${monthStr}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(inv);
  }

  let updated = 0;
  for (const [key, group] of Array.from(groups.entries())) {
    const [prefix, monthStr] = key.split(":");
    // Sort by original invoiceNo (lexicographic preserves YYYY-MM-DD-NN order correctly)
    group.sort((a: any, b: any) => (a.invoiceNo as string).localeCompare(b.invoiceNo as string));

    // Find the highest existing new-format number for this prefix+month (if any were already migrated)
    const existingNewFormat = await InvoiceModel.findOne({
      invoiceNo: { $regex: `^${prefix}-${monthStr}-\\d{3}$` }
    }).sort({ invoiceNo: -1 }) as any;
    let startAt = existingNewFormat
      ? parseInt(existingNewFormat.invoiceNo.split("-").pop(), 10) + 1
      : 1;

    for (let i = 0; i < group.length; i++) {
      const newNo = `${prefix}-${monthStr}-${(startAt + i).toString().padStart(3, "0")}`;
      if (group[i].invoiceNo !== newNo) {
        await InvoiceModel.findByIdAndUpdate(group[i]._id, { invoiceNo: newNo });
        updated++;
      }
    }
  }

  if (updated > 0) {
    console.log(`[invoice-migration] Converted ${updated} invoices to monthly format (YYYY-MM-NNN).`);
  }
  return updated;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  await connectDB();
  await migrateInvoicesToMonthlyFormat();
  await seedHsnCodes();

  app.use(cookieParser());

  app.patch("/api/inquiries/:id", async (req, res) => {
    try {
      const inquiry = await storage.updateInquiry(req.params.id, req.body);
      if (!inquiry)
        return res.status(404).json({ message: "Inquiry not found" });
      res.json(inquiry);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Session middleware
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} [express] ${req.method} ${req.url}`);
    next();
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "default_secret",
      store: storage.sessionStore,
      name: "sid",
      proxy: true,
      cookie: {
        secure: false,
        sameSite: "lax",
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
      rolling: true,
      resave: true,
      saveUninitialized: true,
    }),
  );

// Clear logs for production once fixed
app.use((req, res, next) => {
  if (req.url.startsWith("/api/")) {
    console.log(`${new Date().toISOString()} [API] ${req.method} ${req.url} - sid: ${req.cookies?.sid ? "exists" : "missing"} - user: ${(req.session as any)?.userId || "none"}`);
  }
  next();
});

  // Auth Routes
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { email, password } = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByEmail(email);

      if (!user || user.password !== password) {
        // Simple password check for now as per instructions (no hash mentioned, but recommended)
        // For production, use bcrypt.
        return res.status(401).json({ message: "Invalid email or password" });
      }

      (req.session as any).userId = user.id;
      res.json({ id: user.id, email: user.email });
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => {
      res.sendStatus(200);
    });
  });

  app.get(api.auth.me.path, async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.sendStatus(401);

    const user = await storage.getUser(userId);
    if (!user) return res.sendStatus(401);

    res.json({ id: user.id, email: user.email, name: user.name });
  });

  app.patch("/api/user", async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.sendStatus(401);

    try {
      const user = await storage.updateUser(userId, req.body);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ id: user.id, email: user.email, name: user.name });
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Dashboard Route
  app.get("/api/dashboard", async (req, res) => {
    if (!(req.session as any).userId) {
      return res.status(401).send("Unauthorized");
    }
    try {
      const data = await storage.getDashboardData();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      res
        .status(500)
        .json({ message: error.message || "Internal server error" });
    }
  });

  // Customer Routes
  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await (storage as any).getCustomers();
      res.json(customers);
    } catch (error: any) {
      console.error("Error fetching customers:", error);
      res
        .status(500)
        .json({ message: error.message || "Internal server error" });
    }
  });

  app.get("/api/customers/by-phone/:phone", async (req, res) => {
    try {
      const { phone } = req.params;
      const customerData = await (storage as any).getJobCardsByPhone(phone);
      if (customerData) {
        res.json(customerData);
      } else {
        res.status(404).json({ message: "Customer not found" });
      }
    } catch (error: any) {
      console.error("Error fetching customer by phone:", error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Masters Routes
  app.get(api.masters.services.list.path, async (req, res) => {
    const services = await storage.getServices();
    res.json(services);
  });

  app.post(api.masters.services.create.path, async (req, res) => {
    try {
      const input = api.masters.services.create.input.parse(req.body);
      const service = await storage.createService(input);
      res.status(201).json(service);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.patch("/api/masters/services/:id", async (req, res) => {
    try {
      const service = await storage.updateService(req.params.id, req.body);
      if (!service)
        return res.status(404).json({ message: "Service not found" });
      res.json(service);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/masters/services/:id", async (req, res) => {
    const success = await storage.deleteService(req.params.id);
    if (!success) return res.status(404).json({ message: "Service not found" });
    res.json({ message: "Service deleted" });
  });

  app.get(api.masters.ppf.list.path, async (req, res) => {
    const ppfs = await storage.getPPFs();
    res.json(ppfs);
  });

  app.post(api.masters.ppf.create.path, async (req, res) => {
    try {
      const ppf = await storage.createPPF(req.body);
      res.status(201).json(ppf);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.patch("/api/masters/ppf/:id", async (req, res) => {
    try {
      const ppf = await storage.updatePPF(req.params.id, req.body);
      if (!ppf) return res.status(404).json({ message: "PPF not found" });
      res.json(ppf);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/masters/ppf/:id", async (req, res) => {
    const success = await storage.deletePPF(req.params.id);
    if (!success) return res.status(404).json({ message: "PPF not found" });
    res.json({ message: "PPF deleted" });
  });

  app.get(api.masters.accessories.list.path, async (req, res) => {
    const accessories = await storage.getAccessories();
    res.json(accessories);
  });

  app.post(api.masters.accessories.create.path, async (req, res) => {
    try {
      const accessory = await storage.createAccessory(req.body);
      res.status(201).json(accessory);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.masters.accessories.categories.list.path, async (req, res) => {
    const categories = await storage.getAccessoryCategories();
    res.json(categories);
  });

  app.post(api.masters.accessories.categories.create.path, async (req, res) => {
    try {
      const { name } = api.masters.accessories.categories.create.input.parse(
        req.body,
      );
      const category = await storage.createAccessoryCategory(name);
      res.status(201).json(category);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.patch("/api/masters/accessory-categories/:id", async (req, res) => {
    try {
      const category = await storage.updateAccessoryCategory(
        req.params.id,
        req.body.name,
      );
      if (!category)
        return res.status(404).json({ message: "Category not found" });
      res.json(category);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/masters/accessory-categories/:id", async (req, res) => {
    const success = await storage.deleteAccessoryCategory(req.params.id);
    if (!success)
      return res.status(404).json({ message: "Category not found" });
    res.json({ message: "Category deleted" });
  });

  app.patch("/api/masters/accessories/:id", async (req, res) => {
    try {
      const accessory = await storage.updateAccessory(req.params.id, req.body);
      if (!accessory)
        return res.status(404).json({ message: "Accessory not found" });
      res.json(accessory);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/masters/accessories/:id", async (req, res) => {
    const success = await storage.deleteAccessory(req.params.id);
    if (!success)
      return res.status(404).json({ message: "Accessory not found" });
    res.json({ message: "Accessory deleted" });
  });

  // HSN Code Routes
  app.get("/api/masters/hsn-codes", async (req, res) => {
    const codes = await storage.getHsnCodes();
    res.json(codes);
  });

  app.post("/api/masters/hsn-codes", async (req, res) => {
    try {
      const { code, description } = req.body;
      if (!code || !description) return res.status(400).json({ message: "code and description are required" });
      const created = await storage.createHsnCode({ code, description });
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: "Invalid input or duplicate code" });
    }
  });

  app.patch("/api/masters/hsn-codes/:id", async (req, res) => {
    try {
      const updated = await storage.updateHsnCode(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "HSN Code not found" });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/masters/hsn-codes/:id", async (req, res) => {
    const success = await storage.deleteHsnCode(req.params.id);
    if (!success) return res.status(404).json({ message: "HSN Code not found" });
    res.json({ message: "HSN Code deleted" });
  });

  app.get(api.masters.vehicleTypes.list.path, async (req, res) => {
    const types = await storage.getVehicleTypes();
    res.json(types);
  });

  app.post(api.masters.vehicleTypes.create.path, async (req, res) => {
    try {
      const { name } = api.masters.vehicleTypes.create.input.parse(req.body);
      const type = await storage.createVehicleType(name);
      res.status(201).json(type);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Technician Routes
  app.get(api.technicians.list.path, async (req, res) => {
    const technicians = await storage.getTechnicians();
    res.json(technicians);
  });

  app.post(api.technicians.create.path, async (req, res) => {
    try {
      const input = api.technicians.create.input.parse(req.body);
      const technician = await storage.createTechnician(input);
      res.status(201).json(technician);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.patch("/api/technicians/:id", async (req, res) => {
    try {
      const technician = await storage.updateTechnician(
        req.params.id,
        req.body,
      );
      if (!technician)
        return res.status(404).json({ message: "Technician not found" });
      res.json(technician);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/technicians/:id", async (req, res) => {
    const success = await storage.deleteTechnician(req.params.id);
    if (!success)
      return res.status(404).json({ message: "Technician not found" });
    res.json({ message: "Technician deleted" });
  });

  // Technician Salary Records
  app.get("/api/technicians/:id/salary-records", async (req, res) => {
    const records = await storage.getSalaryRecords(req.params.id);
    res.json(records);
  });

  app.post("/api/technicians/:id/salary-records", async (req, res) => {
    try {
      const record = await storage.createSalaryRecord({ ...req.body, technicianId: req.params.id });
      res.status(201).json(record);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.patch("/api/technicians/:id/salary-records/:recordId", async (req, res) => {
    try {
      const record = await storage.updateSalaryRecord(req.params.recordId, req.body);
      if (!record) return res.status(404).json({ message: "Record not found" });
      res.json(record);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/technicians/:id/salary-records/:recordId", async (req, res) => {
    const success = await storage.deleteSalaryRecord(req.params.recordId);
    if (!success) return res.status(404).json({ message: "Record not found" });
    res.json({ message: "Deleted" });
  });

  // Technician Absences
  app.get("/api/technicians/:id/absences", async (req, res) => {
    const absences = await storage.getAbsences(req.params.id);
    res.json(absences);
  });

  app.post("/api/technicians/:id/absences", async (req, res) => {
    try {
      const absence = await storage.createAbsence({ ...req.body, technicianId: req.params.id });
      res.status(201).json(absence);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/technicians/:id/absences/:absenceId", async (req, res) => {
    const success = await storage.deleteAbsence(req.params.absenceId);
    if (!success) return res.status(404).json({ message: "Absence not found" });
    res.json({ message: "Deleted" });
  });

  // Technician Increments
  app.get("/api/technicians/:id/increments", async (req, res) => {
    const increments = await storage.getIncrements(req.params.id);
    res.json(increments);
  });

  app.post("/api/technicians/:id/increments", async (req, res) => {
    try {
      const increment = await storage.createIncrement({ ...req.body, technicianId: req.params.id });
      // Also update the technician's current monthly salary
      await storage.updateTechnician(req.params.id, { monthlySalary: req.body.newSalary });
      res.status(201).json(increment);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/technicians/:id/increments/:incrementId", async (req, res) => {
    const success = await storage.deleteIncrement(req.params.incrementId);
    if (!success) return res.status(404).json({ message: "Increment not found" });
    res.json({ message: "Deleted" });
  });

  // Appointment Routes
  app.get(api.appointments.list.path, async (req, res) => {
    const appointments = await storage.getAppointments();
    res.json(appointments);
  });

  app.post(api.appointments.create.path, async (req, res) => {
    try {
      const input = api.appointments.create.input.parse(req.body);
      const appointment = await storage.createAppointment(input);
      res.status(201).json(appointment);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.patch("/api/appointments/:id", async (req, res) => {
    try {
      const appointment = await storage.updateAppointment(
        req.params.id,
        req.body,
      );
      if (!appointment)
        return res.status(404).json({ message: "Appointment not found" });
      res.json(appointment);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    const success = await storage.deleteAppointment(req.params.id);
    if (!success)
      return res.status(404).json({ message: "Appointment not found" });
    res.json({ message: "Appointment deleted" });
  });

  // Job Cards Routes
  app.get("/api/job-cards", async (req, res) => {
    const jobs = await storage.getJobCards();
    res.json(jobs);
  });

  // Tickets
  app.get("/api/tickets", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    const tickets = await storage.getTickets();
    res.json(tickets);
  });

  app.post("/api/tickets", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    const ticket = await storage.createTicket(req.body);
    res.json(ticket);
  });

  app.patch("/api/tickets/:id", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    const ticket = await storage.updateTicket(req.params.id, req.body);
    if (!ticket) return res.sendStatus(404);
    res.json(ticket);
  });

  app.delete("/api/tickets/:id", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    await storage.deleteTicket(req.params.id);
    res.sendStatus(204);
  });

  // Old Customers
  app.get("/api/old-customers", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const data = await storage.getOldCustomers(page, limit);
    res.json(data);
  });

  app.post("/api/old-customers", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    const customer = await storage.createOldCustomer(req.body);
    res.json(customer);
  });

  app.get("/api/job-cards/:id", async (req, res) => {
    const job = await storage.getJobCard(req.params.id);
    if (!job) return res.status(404).json({ message: "Job card not found" });
    res.json(job);
  });

  app.post("/api/invoices", async (req, res) => {
    if (!(req.session as any).userId) {
      return res.status(401).send("Unauthorized");
    }
    try {
      const invoice = await storage.createInvoice(req.body);
      res.status(201).json(invoice);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid input" });
    }
  });

  app.get("/api/invoices", async (req, res) => {
    if (!(req.session as any).userId) {
      return res.status(401).send("Unauthorized");
    }
    const phone = req.query.phone as string;
    if (phone) {
      const invoices = await storage.getInvoicesByPhone(phone);
      return res.json(invoices);
    }
    const invoices = await storage.getInvoices();
    res.json(invoices);
  });

  app.get("/api/invoices/:id", async (req, res) => {
    if (!(req.session as any).userId) {
      return res.status(401).send("Unauthorized");
    }
    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(invoice);
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    if (!(req.session as any).userId) {
      return res.status(401).send("Unauthorized");
    }
    try {
      console.log("[PATCH INVOICE] id:", req.params.id, "body:", JSON.stringify(req.body));
      const invoice = await storage.updateInvoice(req.params.id, req.body);
      if (!invoice)
        return res.status(404).json({ message: "Invoice not found" });
      res.json(invoice);
    } catch (error: any) {
      console.error("[PATCH INVOICE] Error:", error);
      res.status(400).json({ message: error.message || "Invalid input" });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    if (!(req.session as any).userId) {
      return res.status(401).send("Unauthorized");
    }
    console.log(`[DELETE INVOICE ROUTE] ID: ${req.params.id}`);
    try {
      const success = await storage.deleteInvoice(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json({ message: "Invoice deleted" });
    } catch (error: any) {
      console.error("[DELETE INVOICE ERROR]", error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  app.post("/api/job-cards", async (req, res) => {
    console.log("[CREATE JOB] perBusinessPayments received:", JSON.stringify((req.body as any).perBusinessPayments));
    const job = await storage.createJobCard(req.body);
    res.json(job);
  });

  app.post("/api/debug/reset-balances", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    try {
      await mongoose
        .model("Invoice")
        .updateMany({}, { $set: { payments: [], isPaid: false } });
      res.json({ message: "All balances reset to zero (payments cleared)" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/job-cards/:id", async (req, res) => {
    try {
      console.log("Updating job card:", req.params.id, req.body);
      const job = await storage.updateJobCard(req.params.id, req.body);
      if (!job) return res.status(404).json({ message: "Job card not found" });
      res.json(job);
    } catch (error: any) {
      console.error("Error updating job card:", error);
      res.status(400).json({ message: error.message || "Invalid input" });
    }
  });

  app.delete("/api/job-cards/:id", async (req, res) => {
    const success = await storage.deleteJobCard(req.params.id);
    if (!success)
      return res.status(404).json({ message: "Job card not found" });
    res.json({ message: "Job card deleted" });
  });

  // Inquiry Routes
  app.get("/api/inquiries", async (req, res) => {
    const phone = req.query.phone as string;
    if (phone) {
      const inquiries = await storage.getInquiriesByPhone(phone);
      return res.json(inquiries);
    }
    const inquiries = await storage.getInquiries();
    res.json(inquiries);
  });

  app.post("/api/inquiries", async (req, res) => {
    try {
      const inquiry = await storage.createInquiry(req.body);
      res.status(201).json(inquiry);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/inquiries/:id", async (req, res) => {
    const success = await storage.deleteInquiry(req.params.id);
    if (!success) return res.status(404).json({ message: "Inquiry not found" });
    res.json({ message: "Inquiry deleted" });
  });

  // Vendor Management Routes
  app.get("/api/vendors", async (req, res) => {
    const vendors = await storage.getVendors();
    res.json(vendors);
  });

  app.get("/api/vendors/:id", async (req, res) => {
    const vendor = await storage.getVendor(req.params.id);
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });
    res.json(vendor);
  });

  app.post("/api/vendors", async (req, res) => {
    try {
      const vendor = await storage.createVendor(req.body);
      res.status(201).json(vendor);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.patch("/api/vendors/:id", async (req, res) => {
    try {
      const vendor = await storage.updateVendor(req.params.id, req.body);
      if (!vendor) return res.status(404).json({ message: "Vendor not found" });
      res.json(vendor);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/vendors/:id", async (req, res) => {
    const success = await storage.deleteVendor(req.params.id);
    if (!success) return res.status(404).json({ message: "Vendor not found" });
    res.json({ message: "Vendor deleted" });
  });

  // Vendor Purchase Routes
  // ─── Balance Invoices (dashboard detail view) ──────────────────────────────
  app.get("/api/dashboard/balance-invoices", async (req, res) => {
    if (!(req.session as any).userId) return res.status(401).send("Unauthorized");
    try {
      const invoices = await storage.getInvoices();
      const balanceInvoices = invoices
        .map(inv => {
          const paid = (inv.payments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
          const balance = (inv.totalAmount || 0) - paid;
          return { ...inv, paidAmount: paid, balanceAmount: balance };
        })
        .filter(inv => inv.balanceAmount > 0)
        .sort((a, b) => b.balanceAmount - a.balanceAmount);
      res.json(balanceInvoices);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Internal server error" });
    }
  });

  app.get("/api/vendor-purchases", async (req, res) => {
    const vendorId = req.query.vendorId as string | undefined;
    const purchases = await storage.getVendorPurchases(vendorId);
    res.json(purchases);
  });

  app.get("/api/vendor-purchases/:id", async (req, res) => {
    const purchase = await storage.getVendorPurchase(req.params.id);
    if (!purchase) return res.status(404).json({ message: "Purchase not found" });
    res.json(purchase);
  });

  // Convert flat purchase pricing rows [{vehicleType, warranty, price}]
  // into PPFMaster's nested format [{vehicleType, options:[{warrantyName, price}]}]
  function flatPricingToByVehicleType(flatPricing: any[]): any[] {
    const map = new Map<string, Array<{warrantyName: string; price: number}>>();
    for (const row of flatPricing) {
      if (!row.vehicleType || !row.warranty) continue;
      const vtKey = row.vehicleType.trim();
      if (!map.has(vtKey)) map.set(vtKey, []);
      map.get(vtKey)!.push({ warrantyName: row.warranty.trim(), price: Number(row.price) || 0 });
    }
    return Array.from(map.entries()).map(([vehicleType, options]) => ({ vehicleType, options }));
  }

  // Merge incoming pricingByVehicleType into existing without overwriting existing entries
  function mergePricing(existing: any[], incoming: any[]): any[] {
    const merged = existing.map(e => ({ ...e, options: [...(e.options || [])] }));
    for (const inc of incoming) {
      const existingVT = merged.find(e => e.vehicleType === inc.vehicleType);
      if (!existingVT) {
        merged.push({ ...inc });
      } else {
        for (const opt of (inc.options || [])) {
          const exists = existingVT.options.some((o: any) => o.warrantyName === opt.warrantyName);
          if (!exists) existingVT.options.push(opt);
        }
      }
    }
    return merged;
  }

  async function syncPurchaseItemsToMasters(items: any[]) {
    if (!items || !Array.isArray(items)) return;
    const [existingPPFs, existingAccessories, existingCategories] = await Promise.all([
      storage.getPPFs(),
      storage.getAccessories(),
      storage.getAccessoryCategories(),
    ]);

    const ppfByName = new Map(existingPPFs.map(p => [p.name.trim().toLowerCase(), p]));
    const categoryNames = new Set(existingCategories.map(c => c.name.trim().toLowerCase()));
    const accessoryKeys = new Set(existingAccessories.map(a => `${a.category.trim().toLowerCase()}::${a.name.trim().toLowerCase()}`));

    for (const item of items) {
      if (!item.name || !item.name.trim()) continue;
      const itemName = item.name.trim();

      if (item.itemType === "PPF") {
        const rollName = (item.rollName || "").trim() || `Roll ${new Date().toLocaleDateString("en-IN")}`;
        const rollStock = Number(item.quantity) || 0;
        const newRoll = { name: rollName, stock: rollStock };

        // Convert flat pricing rows to PPFMaster nested format
        const flatPricing = Array.isArray(item.ppfPricing) ? item.ppfPricing : [];
        const newPricingByVehicleType = flatPricingToByVehicleType(flatPricing);

        const itemHsnCode = (item.hsnCode || "").trim();
        const existingPPF = ppfByName.get(itemName.toLowerCase());
        if (!existingPPF) {
          const created = await storage.createPPF({
            name: itemName,
            hsnCode: itemHsnCode,
            pricingByVehicleType: newPricingByVehicleType,
            rolls: [newRoll],
          });
          ppfByName.set(itemName.toLowerCase(), created);
        } else if (existingPPF.id) {
          const existingRolls = existingPPF.rolls || [];
          const mergedPricing = mergePricing(existingPPF.pricingByVehicleType || [], newPricingByVehicleType);
          const updatedPPF = await storage.updatePPF(existingPPF.id, {
            ...existingPPF,
            hsnCode: itemHsnCode || existingPPF.hsnCode || "",
            pricingByVehicleType: mergedPricing,
            rolls: [...existingRolls, newRoll],
          });
          if (updatedPPF) ppfByName.set(itemName.toLowerCase(), updatedPPF);
        }
      } else if (item.itemType === "Accessory") {
        const catName = (item.categoryName || "").trim();
        if (!catName) continue;

        if (!categoryNames.has(catName.toLowerCase())) {
          await storage.createAccessoryCategory(catName);
          categoryNames.add(catName.toLowerCase());
        }

        const itemHsnCode = (item.hsnCode || "").trim();
        const purchasedQty = Number(item.quantity) || 0;
        const accKey = `${catName.toLowerCase()}::${itemName.toLowerCase()}`;
        if (!accessoryKeys.has(accKey)) {
          await storage.createAccessory({
            category: catName,
            name: itemName,
            quantity: purchasedQty,
            price: Number(item.sellingPrice) || Number(item.unitPrice) || 0,
            hsnCode: itemHsnCode,
          });
          accessoryKeys.add(accKey);
        } else {
          // Accessory already exists — add the purchased quantity to existing stock
          const existing = existingAccessories.find(
            a => a.category.trim().toLowerCase() === catName.toLowerCase() &&
                 a.name.trim().toLowerCase() === itemName.toLowerCase()
          );
          if (existing && existing.id) {
            await storage.updateAccessory(existing.id, {
              quantity: (existing.quantity || 0) + purchasedQty,
              hsnCode: itemHsnCode || existing.hsnCode || "",
            });
          }
        }
      }
    }
  }

  app.post("/api/vendor-purchases", async (req, res) => {
    try {
      const purchase = await storage.createVendorPurchase(req.body);
      await syncPurchaseItemsToMasters(req.body.items);
      res.status(201).json(purchase);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.patch("/api/vendor-purchases/:id", async (req, res) => {
    try {
      const purchase = await storage.updateVendorPurchase(req.params.id, req.body);
      if (!purchase) return res.status(404).json({ message: "Purchase not found" });
      await syncPurchaseItemsToMasters(req.body.items);
      res.json(purchase);
    } catch (error) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  async function reverseSyncPurchaseItems(items: any[]) {
    if (!items || !Array.isArray(items)) return;
    const [existingPPFs, existingAccessories] = await Promise.all([
      storage.getPPFs(),
      storage.getAccessories(),
    ]);

    for (const item of items) {
      if (!item.name || !item.name.trim()) continue;
      const itemName = item.name.trim();

      if (item.itemType === "PPF") {
        const existingPPF = existingPPFs.find(p => p.name.trim().toLowerCase() === itemName.toLowerCase());
        if (existingPPF && existingPPF.id) {
          const rollName = (item.rollName || "").trim();
          const updatedRolls = rollName
            ? (existingPPF.rolls || []).filter((r: any) => r.name !== rollName)
            : (existingPPF.rolls || []).slice(0, -1);
          await storage.updatePPF(existingPPF.id, { ...existingPPF, rolls: updatedRolls });
        }
      } else if (item.itemType === "Accessory") {
        const catName = (item.categoryName || "").trim();
        if (!catName) continue;
        const purchasedQty = Number(item.quantity) || 0;
        const existing = existingAccessories.find(
          a => a.category.trim().toLowerCase() === catName.toLowerCase() &&
               a.name.trim().toLowerCase() === itemName.toLowerCase()
        );
        if (existing && existing.id) {
          const newQty = Math.max(0, (existing.quantity || 0) - purchasedQty);
          await storage.updateAccessory(existing.id, { quantity: newQty });
        }
      }
    }
  }

  app.delete("/api/vendor-purchases/:id", async (req, res) => {
    const purchase = await storage.getVendorPurchase(req.params.id);
    if (!purchase) return res.status(404).json({ message: "Purchase not found" });
    try {
      await reverseSyncPurchaseItems(purchase.items as any[]);
    } catch (err) {
      console.error("[DELETE PURCHASE] reverseSyncPurchaseItems error:", err);
    }
    const success = await storage.deleteVendorPurchase(req.params.id);
    if (!success) return res.status(404).json({ message: "Purchase not found" });
    res.json({ message: "Purchase deleted" });
  });

  // Expense Routes
  app.get("/api/expenses", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    const expenses = await storage.getExpenses();
    res.json(expenses);
  });

  app.post("/api/expenses", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    try {
      const expense = await storage.createExpense(req.body);
      res.status(201).json(expense);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid input" });
    }
  });

  app.patch("/api/expenses/:id", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    try {
      const expense = await storage.updateExpense(req.params.id, req.body);
      if (!expense) return res.status(404).json({ message: "Expense not found" });
      res.json(expense);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid input" });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    const success = await storage.deleteExpense(req.params.id);
    if (!success) return res.status(404).json({ message: "Expense not found" });
    res.json({ message: "Expense deleted" });
  });

  // ── Warranty Items (auto-populated from invoices) ─────────────────────────
  app.get("/api/warranty-items", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    try {
      const items = await storage.getWarrantyItems();
      res.json(items);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── Warranty Follow-up Routes ─────────────────────────────────────────────
  app.get("/api/warranty-followups", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    const docs = await storage.getWarrantyFollowUps();
    res.json(docs);
  });

  app.get("/api/warranty-followups/:id", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    const doc = await storage.getWarrantyFollowUp(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  });

  app.post("/api/warranty-followups", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    try {
      const doc = await storage.createWarrantyFollowUp(req.body);
      res.status(201).json(doc);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Invalid input" });
    }
  });

  app.patch("/api/warranty-followups/:id", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    const doc = await storage.updateWarrantyFollowUp(req.params.id, req.body);
    if (!doc) return res.status(404).json({ message: "Not found" });
    res.json(doc);
  });

  app.delete("/api/warranty-followups/:id", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    const ok = await storage.deleteWarrantyFollowUp(req.params.id);
    if (!ok) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  });

  // Migration: Re-number all existing invoices in new format AG-YYYY-MM-DD-NN
  app.post("/api/admin/migrate-invoice-numbers", async (req, res) => {
    if (!(req.session as any).userId) return res.sendStatus(401);
    try {
      const updated = await migrateInvoicesToMonthlyFormat();
      res.json({ message: `Migration complete. ${updated} invoices updated.` });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Migration failed" });
    }
  });

  // ── Resell Orders ────────────────────────────────────────────────────────────
  app.get("/api/resell", async (req, res) => {
    try {
      const orders = await storage.getResellOrders();
      res.json(orders);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/resell", async (req, res) => {
    try {
      const body = req.body;

      if (!body.buyerName?.trim()) return res.status(400).json({ message: "Buyer name is required" });
      if (!body.date) return res.status(400).json({ message: "Date is required" });
      if (!body.itemType) return res.status(400).json({ message: "Item type is required" });
      if ((body.unitPrice ?? 0) < 0) return res.status(400).json({ message: "Unit price must be 0 or more" });

      if (body.itemType === "Accessory") {
        if (!body.accessoryId) return res.status(400).json({ message: "Please select an accessory" });
        const qty = Number(body.quantity);
        if (!qty || qty <= 0) return res.status(400).json({ message: "Quantity must be greater than 0" });

        const acc = await AccessoryMasterModel.findById(body.accessoryId);
        if (!acc) return res.status(404).json({ message: "Accessory not found" });
        if (acc.quantity < qty) {
          return res.status(400).json({ message: `Insufficient stock. Available: ${acc.quantity} pcs` });
        }
        acc.quantity -= qty;
        await acc.save();

      } else if (body.itemType === "PPF") {
        if (!body.ppfBrandId) return res.status(400).json({ message: "Please select a PPF brand" });
        if (!body.ppfRollId) return res.status(400).json({ message: "Please select a PPF roll" });
        const sqft = Number(body.sqft);
        if (!sqft || sqft <= 0) return res.status(400).json({ message: "Sqft must be greater than 0" });

        const ppf = await PPFMasterModel.findById(body.ppfBrandId);
        if (!ppf) return res.status(404).json({ message: "PPF brand not found" });
        const roll = (ppf.rolls as any[]).find((r: any) => r._id.toString() === body.ppfRollId);
        if (!roll) return res.status(404).json({ message: "PPF roll not found" });
        if (roll.stock < sqft) {
          return res.status(400).json({ message: `Insufficient stock. Available: ${roll.stock} sqft` });
        }
        roll.stock -= sqft;
        ppf.markModified("rolls");
        await ppf.save();
      } else {
        return res.status(400).json({ message: "Invalid item type" });
      }

      const count = await ResellOrderModel.countDocuments();
      const invoiceNo = `RS-${String(count + 1).padStart(4, "0")}`;
      const order = await storage.createResellOrder({ ...body, invoiceNo });
      res.status(201).json(order);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/resell/:id", async (req, res) => {
    try {
      const order = await storage.updateResellOrder(req.params.id, req.body);
      if (!order) return res.status(404).json({ message: "Resell order not found" });
      res.json(order);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/resell/:id", async (req, res) => {
    try {
      const ok = await storage.deleteResellOrder(req.params.id);
      if (!ok) return res.status(404).json({ message: "Resell order not found" });
      res.json({ message: "Deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Seed default user if not exists
  if (mongoose.connection.readyState === 1) {
    const defaultEmail = "abhishek@autogamma.in";
    const existing = await storage.getUserByEmail(defaultEmail);
    if (!existing) {
      await storage.createUser({
        email: defaultEmail,
        password: "Abhishek@132231", // Matches the dummy login in screenshot roughly
      });
      console.log("Seeded default user:", defaultEmail);
    }
  } else {
    console.warn("MongoDB not connected, skipping seed.");
  }

  return httpServer;
}
