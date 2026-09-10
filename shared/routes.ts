import { z } from "zod";
import { 
  insertUserSchema, 
  loginSchema, 
  dashboardDataSchema, 
  serviceMasterSchema, 
  insertServiceMasterSchema, 
  ppfMasterSchema,
  insertPPFMasterSchema,
  accessoryMasterSchema,
  insertAccessoryMasterSchema,
  accessoryCategorySchema,
  vehicleTypeSchema,
  technicianSchema,
  insertTechnicianSchema,
  employeeLoanSchema,
  insertEmployeeLoanSchema,
  loanRepaymentSchema,
  appointmentSchema,
  insertAppointmentSchema,
  hsnCodeMasterSchema,
  insertHsnCodeMasterSchema,
} from "./schema";

export const api = {
  auth: {
    login: {
      method: "POST" as const,
      path: "/api/login",
      input: loginSchema,
      responses: {
        200: z.object({ id: z.string(), email: z.string() }),
        401: z.object({ message: z.string() }),
      },
    },
    logout: {
      method: "POST" as const,
      path: "/api/logout",
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: "GET" as const,
      path: "/api/user",
      responses: {
        200: z.object({ id: z.string(), email: z.string(), name: z.string().optional() }),
        401: z.void(),
      },
    },
  },
  dashboard: {
    get: {
      method: "GET" as const,
      path: "/api/dashboard",
      responses: {
        200: dashboardDataSchema,
      },
    },
  },
  masters: {
    services: {
      list: {
        method: "GET" as const,
        path: "/api/masters/services",
        responses: {
          200: z.array(serviceMasterSchema),
        },
      },
      create: {
        method: "POST" as const,
        path: "/api/masters/services",
        input: insertServiceMasterSchema,
        responses: {
          201: serviceMasterSchema,
        },
      },
      update: {
        method: "PATCH" as const,
        path: "/api/masters/services/:id",
        input: serviceMasterSchema.partial(),
        responses: {
          200: serviceMasterSchema,
          404: z.object({ message: z.string() }),
        },
      },
      delete: {
        method: "DELETE" as const,
        path: "/api/masters/services/:id",
        responses: {
          200: z.void(),
          404: z.object({ message: z.string() }),
        },
      },
    },
    ppf: {
      list: {
        method: "GET" as const,
        path: "/api/masters/ppf",
        responses: {
          200: z.array(ppfMasterSchema),
        },
      },
      create: {
        method: "POST" as const,
        path: "/api/masters/ppf",
        input: z.any(), // Flexible input for complex nested data
        responses: {
          201: z.any(),
        },
      },
      update: {
        method: "PATCH" as const,
        path: "/api/masters/ppf/:id",
        input: z.any(),
        responses: {
          200: z.any(),
          404: z.object({ message: z.string() }),
        },
      },
      delete: {
        method: "DELETE" as const,
        path: "/api/masters/ppf/:id",
        responses: {
          200: z.void(),
          404: z.object({ message: z.string() }),
        },
      },
    },
    vehicleTypes: {
      list: {
        method: "GET" as const,
        path: "/api/masters/vehicle-types",
        responses: {
          200: z.array(vehicleTypeSchema),
        },
      },
      create: {
        method: "POST" as const,
        path: "/api/masters/vehicle-types",
        input: vehicleTypeSchema.omit({ id: true }),
        responses: {
          201: vehicleTypeSchema,
        },
      },
    },
    accessories: {
      categories: {
        list: {
          method: "GET" as const,
          path: "/api/masters/accessory-categories",
          responses: {
            200: z.array(accessoryCategorySchema),
          },
        },
        create: {
          method: "POST" as const,
          path: "/api/masters/accessory-categories",
          input: accessoryCategorySchema.omit({ id: true }),
          responses: {
            201: accessoryCategorySchema,
          },
        },
        update: {
          method: "PATCH" as const,
          path: "/api/masters/accessory-categories/:id",
          input: accessoryCategorySchema.omit({ id: true }).partial(),
          responses: {
            200: accessoryCategorySchema,
            404: z.object({ message: z.string() }),
          },
        },
        delete: {
          method: "DELETE" as const,
          path: "/api/masters/accessory-categories/:id",
          responses: {
            200: z.void(),
            404: z.object({ message: z.string() }),
          },
        },
      },
      list: {
        method: "GET" as const,
        path: "/api/masters/accessories",
        responses: {
          200: z.array(accessoryMasterSchema),
        },
      },
      create: {
        method: "POST" as const,
        path: "/api/masters/accessories",
        input: insertAccessoryMasterSchema,
        responses: {
          201: accessoryMasterSchema,
        },
      },
      update: {
        method: "PATCH" as const,
        path: "/api/masters/accessories/:id",
        input: accessoryMasterSchema.partial(),
        responses: {
          200: accessoryMasterSchema,
          404: z.object({ message: z.string() }),
        },
      },
      delete: {
        method: "DELETE" as const,
        path: "/api/masters/accessories/:id",
        responses: {
          200: z.void(),
          404: z.object({ message: z.string() }),
        },
      },
    },
    hsnCodes: {
      list: {
        method: "GET" as const,
        path: "/api/masters/hsn-codes",
        responses: { 200: z.array(hsnCodeMasterSchema) },
      },
      create: {
        method: "POST" as const,
        path: "/api/masters/hsn-codes",
        input: insertHsnCodeMasterSchema,
        responses: { 201: hsnCodeMasterSchema },
      },
      update: {
        method: "PATCH" as const,
        path: "/api/masters/hsn-codes/:id",
        input: hsnCodeMasterSchema.partial(),
        responses: { 200: hsnCodeMasterSchema, 404: z.object({ message: z.string() }) },
      },
      delete: {
        method: "DELETE" as const,
        path: "/api/masters/hsn-codes/:id",
        responses: { 200: z.void(), 404: z.object({ message: z.string() }) },
      },
    },
  },
  technicians: {
    list: {
      method: "GET" as const,
      path: "/api/technicians",
      responses: {
        200: z.array(technicianSchema),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/technicians",
      input: insertTechnicianSchema,
      responses: {
        201: technicianSchema,
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/technicians/:id",
      input: technicianSchema.partial(),
      responses: {
        200: technicianSchema,
        404: z.object({ message: z.string() }),
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/technicians/:id",
      responses: {
        200: z.void(),
        404: z.object({ message: z.string() }),
      },
    },
  },
  employeeLoans: {
    list: {
      method: "GET" as const,
      path: "/api/employee-loans",
      responses: { 200: z.array(employeeLoanSchema) },
    },
    create: {
      method: "POST" as const,
      path: "/api/employee-loans",
      input: insertEmployeeLoanSchema,
      responses: { 201: employeeLoanSchema },
    },
    addRepayment: {
      method: "POST" as const,
      path: "/api/employee-loans/:id/repayments",
      input: loanRepaymentSchema.omit({ id: true }),
      responses: { 201: employeeLoanSchema },
    },
  },
  appointments: {
    list: {
      method: "GET" as const,
      path: "/api/appointments",
      responses: {
        200: z.array(appointmentSchema),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/appointments",
      input: insertAppointmentSchema,
      responses: {
        201: appointmentSchema,
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/appointments/:id",
      input: appointmentSchema.partial(),
      responses: {
        200: appointmentSchema,
        404: z.object({ message: z.string() }),
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/appointments/:id",
      responses: {
        200: z.void(),
        404: z.object({ message: z.string() }),
      },
    },
  },
};
