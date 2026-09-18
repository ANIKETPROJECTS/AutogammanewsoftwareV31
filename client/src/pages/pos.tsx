import { Layout } from "@/components/layout/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HsnCombobox } from "@/components/ui/hsn-combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { AccessoryMaster, ServiceMaster } from "@shared/schema";
import { calculateGstAmounts, formatGstAmount, splitGstAmount } from "@shared/gst";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Car,
  Check,
  ChevronDown,
  CircleUserRound,
  CreditCard,
  Grid2X2,
  Loader2,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { checkQzTray, printRawReceipt } from "@/lib/qz";

type PosItem = {
  cartId: string;
  id: string;
  name: string;
  price: number;
  warranty?: string;
  type: "Service" | "Accessory";
  business: "Auto Gamma" | "AGNX";
  category?: string;
  quantity: number;
  stock?: number;
  buffer?: number;
  hsnCode?: string;
};

type PosPayment = {
  amount: string;
  method: string;
  date: string;
  business?: "Auto Gamma" | "AGNX";
};

const money = (value: number) =>
  `₹${Math.max(0, Math.round(value)).toLocaleString("en-IN")}`;

function getServicePricing(service: ServiceMaster, vehicleType: string) {
  return (service.pricingByVehicleType || []).find(
    (entry: any) => entry.vehicleType === vehicleType,
  ) as any;
}

function getServicePrice(
  service: ServiceMaster,
  vehicleType: string,
  warrantyName?: string,
) {
  const pricing = getServicePricing(service, vehicleType);

  if (!pricing) return 0;
  const warrantyOption = pricing.warrantyOptions?.find(
    (option: any) => option.warrantyName === warrantyName,
  );
  return Number(
    warrantyOption?.price ||
      pricing.price ||
      pricing.warrantyOptions?.[0]?.price ||
      0,
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const STANDARD_REGISTRATION_PATTERN = /^[A-Z]{2}\s\d{2}\s[A-Z]{2}\s\d{4}$/;
const BHARAT_REGISTRATION_PATTERN = /^\d{2}\sBH\s\d{4}\s[A-Z]{2}$/;

function isValidRegistration(value: string) {
  return (
    STANDARD_REGISTRATION_PATTERN.test(value) ||
    BHARAT_REGISTRATION_PATTERN.test(value)
  );
}

function formatRegistration(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const isBharatSeries = compact.length >= 4 && /^\d{2}BH/.test(compact);
  const parts = isBharatSeries
    ? [
        compact.substring(0, 2),
        compact.substring(2, 4),
        compact.substring(4, 8),
        compact.substring(8, 10),
      ]
    : [
        compact.substring(0, 2),
        compact.substring(2, 4),
        compact.substring(4, 6),
        compact.substring(6, 10),
      ];

  return parts.filter(Boolean).join(" ").trim();
}

export default function PosPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const editJobId = new URLSearchParams(useSearch()).get("edit");
  const [activeSection, setActiveSection] = useState<"services" | "accessories">(
    "accessories",
  );
  const [search, setSearch] = useState("");
  const [accessoryCategory, setAccessoryCategory] = useState("All");
  const [cart, setCart] = useState<PosItem[]>([]);
  const [warrantySelection, setWarrantySelection] = useState<{
    service: ServiceMaster;
    options: Array<{ warrantyName: string; price: number }>;
  } | null>(null);
  const [laborCharge, setLaborCharge] = useState(0);
  const [laborBusiness, setLaborBusiness] = useState<"Auto Gamma" | "AGNX">("Auto Gamma");
  const [discount, setDiscount] = useState(0);
  const [gst, setGst] = useState(18);
  const [gstMode, setGstMode] = useState<"exclusive" | "inclusive">("exclusive");
  const [payments, setPayments] = useState<PosPayment[]>([
    {
      amount: "",
      method: "Cash",
      date: new Date().toISOString().split("T")[0],
    },
  ]);
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    gstNumber: "",
  });
  const [hasGst, setHasGst] = useState(false);
  const [vehicle, setVehicle] = useState({
    make: "",
    model: "",
    year: "",
    licensePlate: "",
    type: "",
  });
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);
  const [printOnComplete, setPrintOnComplete] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [pendingReceipt, setPendingReceipt] = useState<string | null>(null);
  const [isRetryingPrint, setIsRetryingPrint] = useState(false);
  const qzCheckMutation = useMutation({
    mutationFn: checkQzTray,
    onSuccess: ({ printers, defaultPrinter }) => {
      const printerSummary = printers.length
        ? printers.join(", ")
        : "No Windows printers found";
      toast({
        title: "QZ Tray connected",
        description: defaultPrinter
          ? `Found ${printerSummary}. Default: ${defaultPrinter}.`
          : `Found ${printerSummary}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "QZ Tray check failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery<
    ServiceMaster[]
  >({
    queryKey: [api.masters.services.list.path],
  });
  const { data: accessories = [], isLoading: accessoriesLoading } = useQuery<
    AccessoryMaster[]
  >({
    queryKey: [api.masters.accessories.list.path],
  });
  const { data: vehicleTypes = [] } = useQuery<any[]>({
    queryKey: [api.masters.vehicleTypes.list.path],
  });
  const { data: editingJob, isLoading: editingJobLoading } = useQuery<any>({
    queryKey: [editJobId ? `/api/job-cards/${editJobId}` : "/api/job-cards/edit-disabled"],
    enabled: Boolean(editJobId),
  });
  const [initializedEditJobId, setInitializedEditJobId] = useState<string | null>(null);

  useEffect(() => {
    if (customer.phone.length !== 10) return;

    let cancelled = false;
    setIsLoadingCustomer(true);
    fetch(`/api/customers/by-phone/${customer.phone}`, {
      credentials: "include",
    })
      .then((response) => {
        if (!response.ok) throw new Error("Customer not found");
        return response.json();
      })
      .then((savedCustomer) => {
        if (cancelled || !savedCustomer) return;
        setCustomer((current) => ({
          ...current,
          name: savedCustomer.customerName || current.name,
          email: savedCustomer.emailAddress || current.email,
          gstNumber: savedCustomer.gstNumber || current.gstNumber,
        }));
        if (savedCustomer.gstNumber) setHasGst(true);

        const savedVehicle =
          savedCustomer.vehicles?.[0] || savedCustomer;
        if (savedVehicle) {
          setVehicle((current) => ({
            ...current,
            make: savedVehicle.make || current.make,
            model: savedVehicle.model || current.model,
            year: String(savedVehicle.year || current.year)
              .replace(/\D/g, "")
              .slice(0, 4),
            licensePlate:
              savedVehicle.licensePlate ||
              savedVehicle.plate ||
              current.licensePlate,
            type: savedVehicle.vehicleType || current.type,
          }));
        }
        toast({
          title: "Customer found",
          description: "Saved customer and vehicle details were filled in.",
        });
      })
      .catch(() => {
        // A new customer can still be entered manually.
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCustomer(false);
      });

    return () => {
      cancelled = true;
    };
  }, [customer.phone, toast]);

  useEffect(() => {
    if (!vehicle.type || services.length === 0) return;

    setCart((current) => {
      let changed = false;
      const next = current.map((item) => {
        if (item.type !== "Service") return item;

        const service = services.find((entry) => entry.id === item.id);
        if (!service) return item;

        const nextPrice = getServicePrice(service, vehicle.type, item.warranty);
        if (nextPrice === item.price) return item;

        changed = true;
        return { ...item, price: nextPrice };
      });

      return changed ? next : current;
    });
  }, [services, vehicle.type]);

  useEffect(() => {
    if (!editJobId) {
      setInitializedEditJobId(null);
      return;
    }
    if (
      !editingJob ||
      servicesLoading ||
      accessoriesLoading ||
      initializedEditJobId === editJobId
    ) {
      return;
    }

    const savedServices = (editingJob.services || []).map((item: any, index: number) => {
      const serviceId = String(item.serviceId || item.id || item._id || "");
      const master = services.find((service) => String(service.id) === serviceId);
      return {
        cartId: `Service-${serviceId}-${index}`,
        id: serviceId,
        name: item.name || master?.name || "Service",
        price: Number(item.price || 0),
        warranty: item.warranty || undefined,
        type: "Service" as const,
        business: item.business === "AGNX" ? "AGNX" as const : "Auto Gamma" as const,
        quantity: 1,
        hsnCode: item.hsnCode || master?.hsnCode || "",
      };
    });
    const savedAccessories = (editingJob.accessories || []).map((item: any, index: number) => {
      const accessoryId = String(item.accessoryId || item.id || item._id || "");
      const master = accessories.find((accessory) => String(accessory.id) === accessoryId);
      const quantity = Math.max(1, Number(item.quantity) || 1);
      return {
        cartId: `Accessory-${accessoryId}-${index}`,
        id: accessoryId,
        name: item.name || master?.name || "Accessory",
        price: Number(item.price || master?.price || 0),
        type: "Accessory" as const,
        business: item.business === "AGNX" ? "AGNX" as const : "Auto Gamma" as const,
        category: item.category || master?.category || "",
        quantity,
        // The saved quantity has already been deducted from stock. Add it back
        // to the visible limit while this existing card is being edited.
        stock: Number(master?.quantity || 0) + quantity,
        hsnCode: item.hsnCode || master?.hsnCode || "",
      };
    });

    setCustomer({
      name: editingJob.customerName || "",
      phone: editingJob.phoneNumber || "",
      email: editingJob.emailAddress || "",
      gstNumber: editingJob.gstNumber || "",
    });
    setHasGst(Boolean(editingJob.gstNumber));
    setVehicle({
      make: editingJob.make || "",
      model: editingJob.model || "",
      year: String(editingJob.year || "").replace(/\D/g, "").slice(0, 4),
      licensePlate: formatRegistration(editingJob.licensePlate || ""),
      type: editingJob.vehicleType || "",
    });
    setCart([...savedServices, ...savedAccessories]);
    setLaborCharge(Number(editingJob.laborCharge || 0));
    setLaborBusiness(editingJob.laborBusiness === "AGNX" ? "AGNX" : "Auto Gamma");
    setDiscount(Number(editingJob.discount || 0));
    setGst(Number(editingJob.gst ?? 18));
    setGstMode(editingJob.gstMode === "inclusive" ? "inclusive" : "exclusive");
    setPayments(
      Array.isArray(editingJob.payments) && editingJob.payments.length > 0
        ? editingJob.payments.map((payment: any) => ({
            amount: String(payment.amount || ""),
            method: payment.method || "Cash",
            date: payment.date || new Date().toISOString().split("T")[0],
          }))
        : [{
            amount: "",
            method: "Cash",
            date: new Date().toISOString().split("T")[0],
          }],
    );
    setActiveSection(savedServices.length > 0 ? "services" : "accessories");
    setInitializedEditJobId(editJobId);
  }, [
    accessories,
    accessoriesLoading,
    editJobId,
    editingJob,
    initializedEditJobId,
    services,
    servicesLoading,
  ]);

  const accessoryCategories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(accessories.map((accessory) => accessory.category))).filter(
        Boolean,
      ),
    ],
    [accessories],
  );

  const visibleServices = useMemo(() => {
    const query = search.toLowerCase().trim();
    return services.filter((service) => {
      const price = getServicePrice(service, vehicle.type);
      return (
        service.name.toLowerCase().includes(query) &&
        (vehicle.type ? price >= 0 : true)
      );
    });
  }, [search, services, vehicle.type]);

  const visibleAccessories = useMemo(() => {
    const query = search.toLowerCase().trim();
    return accessories.filter(
      (accessory) =>
        accessory.name.toLowerCase().includes(query) &&
        (accessoryCategory === "All" ||
          accessory.category === accessoryCategory),
    );
  }, [accessories, accessoryCategory, search]);

  const itemsSubtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  const subtotalWithLabor = itemsSubtotal + laborCharge;
  const afterDiscount = Math.max(0, subtotalWithLabor - discount);
  const { taxableSubtotal, gstAmount, totalAmount: total } = calculateGstAmounts(
    afterDiscount,
    gst,
    gstMode,
  );
  const { sgstAmount, cgstAmount } = splitGstAmount(gstAmount);
  const gstModeLabel = gstMode === "inclusive" ? "Including GST" : "Excluding GST";
  const itemCount = cart.reduce((count, item) => count + item.quantity, 0);
  const businessSubtotals = useMemo(() => {
    const subtotals = {
      "Auto Gamma": laborBusiness === "Auto Gamma" ? laborCharge : 0,
      AGNX: laborBusiness === "AGNX" ? laborCharge : 0,
    };
    cart.forEach((item) => {
      subtotals[item.business] += item.price * item.quantity;
    });
    return subtotals;
  }, [cart, laborBusiness, laborCharge]);
  const businessDiscounts = useMemo(() => {
    const subtotal = Object.values(businessSubtotals).reduce((sum, value) => sum + value, 0);
    if (subtotal <= 0 || discount <= 0) return { "Auto Gamma": 0, AGNX: 0 };
    return {
      "Auto Gamma": discount * (businessSubtotals["Auto Gamma"] / subtotal),
      AGNX: discount * (businessSubtotals.AGNX / subtotal),
    };
  }, [businessSubtotals, discount]);
  const businessTotalsAfterDiscount = useMemo(
    () => ({
      "Auto Gamma": Math.max(
        0,
        businessSubtotals["Auto Gamma"] - businessDiscounts["Auto Gamma"],
      ),
      AGNX: Math.max(0, businessSubtotals.AGNX - businessDiscounts.AGNX),
    }),
    [businessDiscounts, businessSubtotals],
  );
  const businessTotals = useMemo(
    () => ({
      "Auto Gamma": calculateGstAmounts(
        businessTotalsAfterDiscount["Auto Gamma"],
        gst,
        gstMode,
      ).totalAmount,
      AGNX: calculateGstAmounts(
        businessTotalsAfterDiscount.AGNX,
        gst,
        gstMode,
      ).totalAmount,
    }),
    [businessTotalsAfterDiscount, gst, gstMode],
  );
  const activeBusinesses = useMemo(
    () =>
      (["Auto Gamma", "AGNX"] as const).filter(
        (businessName) => businessTotalsAfterDiscount[businessName] > 0,
      ),
    [businessTotalsAfterDiscount],
  );
  const totalPaid = payments.reduce(
    (sum, payment) => sum + (Number(payment.amount) || 0),
    0,
  );
  const remainingPayment = Math.max(0, total - totalPaid);

  const handleAddPayment = () => {
    setPayments((current) => [
      ...current,
      {
        amount: "",
        method: "Cash",
        date: new Date().toISOString().split("T")[0],
        business: activeBusinesses[0],
      },
    ]);
  };

  const handleRemovePayment = (index: number) => {
    setPayments((current) => current.filter((_, paymentIndex) => paymentIndex !== index));
  };

  const handlePaymentChange = (
    index: number,
    field: keyof PosPayment,
    value: string,
  ) => {
    setPayments((current) => {
      const next = [...current];
      let nextValue = value;

      if (field === "amount") {
        const sanitized = value.replace(/[^0-9.]/g, "");
        const otherPayments = current.reduce(
          (sum, payment, paymentIndex) =>
            paymentIndex === index ? sum : sum + (Number(payment.amount) || 0),
          0,
        );
        const maxAllowed = Math.max(0, total - otherPayments);
        const numericValue = Number(sanitized);
        nextValue =
          sanitized !== "" && Number.isFinite(numericValue)
            ? String(Math.min(maxAllowed, numericValue))
            : "";
      }

      next[index] = { ...next[index], [field]: nextValue };
      return next;
    });
  };

  const addToCart = (item: PosItem) => {
    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.cartId === item.cartId);
      if (!existing) return [...current, item];
      return current.map((cartItem) =>
        cartItem.cartId === item.cartId
          ? {
              ...cartItem,
              quantity: Math.min(
                cartItem.quantity + 1,
                cartItem.stock ?? Number.MAX_SAFE_INTEGER,
              ),
            }
          : cartItem,
      );
    });
  };

  const addServiceToCart = (
    service: ServiceMaster,
    warrantyOption?: { warrantyName: string; price: number },
  ) => {
    const pricing = getServicePricing(service, vehicle.type);
    const defaultWarranty = pricing?.warrantyOptions?.length === 1
      ? pricing.warrantyOptions[0]
      : undefined;
    const selectedOption = warrantyOption || defaultWarranty;

    addToCart({
      cartId: `Service-${service.id}`,
      id: service.id || "",
      name: service.name,
      price: Number(selectedOption?.price || pricing?.price || 0),
      warranty: selectedOption?.warrantyName,
      type: "Service",
      business: "Auto Gamma",
      quantity: 1,
      // HSN is optional and must be selected manually for each new POS item.
      hsnCode: "",
    });
  };

  const changeQuantity = (cartId: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.cartId === cartId
            ? {
                ...item,
                quantity: Math.min(
                  item.stock ?? Number.MAX_SAFE_INTEGER,
                  item.quantity + delta,
                ),
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const cleanName = customer.name.trim();
      const cleanPhone = customer.phone.trim();
      const cleanEmail = customer.email.trim();
      const cleanMake = vehicle.make.trim();
      const cleanModel = vehicle.model.trim();
      const cleanYear = vehicle.year.trim();
      const cleanPlate = vehicle.licensePlate.trim();

      if (!cleanName || !cleanMake || !cleanModel || !cleanPlate) {
        throw new Error(
          "Customer name, phone, make, model, and registration number are required.",
        );
      }
      if (!/^\d{10}$/.test(cleanPhone)) {
        throw new Error("Phone number must be exactly 10 digits.");
      }
      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error("Enter a valid email address.");
      }
      if (cleanYear && !/^\d{4}$/.test(cleanYear)) {
        throw new Error("Year must be a 4-digit number.");
      }
      if (!isValidRegistration(cleanPlate)) {
        throw new Error("Registration format: MH 01 AD 7898 or YY BH 0000 AA.");
      }
      if (cart.length === 0) throw new Error("Add at least one service or accessory.");

      const normalizedPayments = payments
        .map((payment) => ({
          amount: Number(payment.amount) || 0,
          method: payment.method,
          date: payment.date,
        }))
        .filter((payment) => payment.amount > 0);
      const receivedAmount = normalizedPayments.reduce(
        (sum, payment) => sum + payment.amount,
        0,
      );
      if (!Number.isFinite(receivedAmount) || receivedAmount < 0) {
        throw new Error("Enter a valid payment amount.");
      }
      if (receivedAmount > total) {
        throw new Error("Payment amount cannot be greater than the bill total.");
      }
      const isPaid = total > 0 && receivedAmount >= total;

      const servicesPayload = cart
        .filter((item) => item.type === "Service")
        .map((item) => ({
          id: item.id,
          serviceId: item.id,
          name: item.name,
          price: item.price,
          warranty: item.warranty,
          business: item.business,
          hsnCode: item.hsnCode || "",
        }));
      const accessoriesPayload = cart
        .filter((item) => item.type === "Accessory")
        .map((item) => ({
          id: item.id,
          accessoryId: item.id,
          name: item.name,
          category: item.category || "",
          price: item.price,
          quantity: item.quantity,
          business: item.business,
          hsnCode: item.hsnCode || "",
        }));
      const perBusinessPayments =
        activeBusinesses.length > 1
          ? Object.fromEntries(
              activeBusinesses.map((businessName) => {
                const businessPayments = payments.filter(
                  (payment) =>
                    (payment.business || activeBusinesses[0]) === businessName,
                );
                const amount = businessPayments.reduce(
                  (sum, payment) => sum + (Number(payment.amount) || 0),
                  0,
                );
                if (amount > businessTotals[businessName]) {
                  throw new Error(
                    `Payment for ${businessName} cannot be greater than its invoice total.`,
                  );
                }
                const payment = businessPayments.find((entry) => Number(entry.amount) > 0) ||
                  businessPayments[0] || {
                amount: 0,
                method: "Cash",
                date: new Date().toISOString().split("T")[0],
                  };
                return [
                  businessName,
                  { amount, method: payment.method, date: payment.date },
                ];
              }),
            )
          : undefined;

      const payload = {
        customerName: cleanName,
        phoneNumber: cleanPhone,
        emailAddress: cleanEmail,
        gstNumber: customer.gstNumber.trim(),
        referralSource: "POS",
        referrerName: "",
        referrerPhone: "",
        make: cleanMake,
        model: cleanModel,
        year: cleanYear,
        licensePlate: cleanPlate,
        vehicleType: vehicle.type,
        services: servicesPayload,
        ppfs: [],
        accessories: accessoriesPayload,
        laborCharge,
        laborBusiness,
        discount,
        autoGammaDiscount: businessDiscounts["Auto Gamma"],
        agnxDiscount: businessDiscounts.AGNX,
        gst,
        gstMode,
        serviceNotes: "Created from POS",
        status: "Completed",
        estimatedCost: total,
        technician: "",
        date: new Date().toISOString(),
        isPaid,
        payments: normalizedPayments,
        perBusinessPayments,
      };
      const response = await apiRequest(
        editJobId ? "PATCH" : "POST",
        editJobId ? `/api/job-cards/${editJobId}` : "/api/job-cards",
        payload,
      );
      return response.json();
    },
    onSuccess: async (job: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-cards"] });
      if (editJobId) {
        queryClient.invalidateQueries({ queryKey: [`/api/job-cards/${editJobId}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.list.path] });
      toast({
        title: editJobId ? "Sale updated" : "Sale completed",
        description: editJobId
          ? "The POS job card and its invoice were updated successfully."
          : "Job card and invoice were saved successfully.",
      });
      if (printOnComplete) {
        const receiptText = buildReceiptText(job);
        try {
          const printer = await printRawReceipt(receiptText);
          setPendingReceipt(null);
          toast({
            title: "Receipt printed",
            description: `Sent to ${printer}.`,
          });
        } catch (error: any) {
          setPendingReceipt(receiptText);
          toast({
            title: "Sale saved, but receipt was not printed",
            description: error?.message || "Check that QZ Tray and the POS printer are ready.",
            variant: "destructive",
          });
          return;
        }
      }
      setLocation("/invoice");
    },
    onError: (error: Error) => {
      toast({
        title: "Could not complete sale",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const renderProductCard = (
    item: ServiceMaster | AccessoryMaster,
    type: "Service" | "Accessory",
  ) => {
    const service = type === "Service" ? (item as ServiceMaster) : null;
    const accessory = type === "Accessory" ? (item as AccessoryMaster) : null;
    const servicePricing = service
      ? getServicePricing(service, vehicle.type)
      : null;
    const warrantyOptions = servicePricing?.warrantyOptions || [];
    const price = service
      ? getServicePrice(service, vehicle.type)
      : Number(accessory?.price || 0);
    const stock = accessory?.quantity;
    const disabled = Boolean(
      service && !vehicle.type,
    );

    return (
      <button
        key={item.id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (service) {
            if (warrantyOptions.length > 1) {
              setWarrantySelection({ service, options: warrantyOptions });
            } else {
              addServiceToCart(service, warrantyOptions[0]);
            }
            return;
          }

          addToCart({
            cartId: `${type}-${item.id}`,
            id: item.id || "",
            name: item.name,
            price,
            type,
            business: "Auto Gamma",
            category: accessory?.category,
            quantity: 1,
             stock: Number(accessory?.quantity || 0) > 0
               ? accessory?.quantity
               : undefined,
             buffer: accessory?.buffer || 0,
            hsnCode: item.hsnCode,
          });
        }}
        className="group flex h-[118px] min-w-0 flex-col overflow-hidden border-b border-r border-slate-200 bg-white p-2.5 text-left transition hover:bg-red-50/30 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <div className="flex items-start justify-between gap-2">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              type === "Service"
                ? "bg-red-50 text-red-600"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {type === "Service" ? (
              <Wrench className="h-4 w-4" />
            ) : (
              <Package className="h-4 w-4" />
            )}
          </div>
        </div>
        <p className="mt-2 min-w-0 flex-1 line-clamp-2 text-xs font-bold leading-4 text-slate-800">
          {item.name}
        </p>
        <div className="flex min-w-0 items-end justify-between gap-1 pt-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-red-600">
              {disabled && service && !vehicle.type
                ? "Select vehicle"
                : service && warrantyOptions.length > 1
                  ? "Select warranty"
                  : money(price)}
            </p>
            {accessory && (
              <p className="truncate text-[10px] leading-3 text-slate-400">
                {Number(stock) > 0
                  ? `${stock} in stock`
                  : Number(accessory.buffer) > 0
                    ? `Out of stock · ${accessory.buffer} buffered`
                    : "Out of stock · add to buffer"}
              </p>
            )}
          </div>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-white transition group-hover:bg-red-700">
            <Plus className="h-3.5 w-3.5" />
          </span>
        </div>
      </button>
    );
  };

  const changeItemBusiness = (cartId: string, nextBusiness: PosItem["business"]) => {
    setCart((current) =>
      current.map((item) =>
        item.cartId === cartId ? { ...item, business: nextBusiness } : item,
      ),
    );
  };

  const changeItemHsn = (cartId: string, hsnCode: string) => {
    setCart((current) =>
      current.map((item) =>
        item.cartId === cartId ? { ...item, hsnCode } : item,
      ),
    );
  };

  const renderBillingPanel = () => (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
        <div>
          <Label className="text-[11px] text-slate-500">Labor Charge (₹)</Label>
          <Input
            type="number"
            min="0"
            value={laborCharge || ""}
            onChange={(event) =>
              setLaborCharge(Math.max(0, Number(event.target.value) || 0))
            }
            className="mt-1 h-8 text-xs"
            placeholder="0"
          />
        </div>
        <div>
          <Label className="text-[11px] text-slate-500">Discount (₹)</Label>
          <Input
            type="number"
            min="0"
            value={discount || ""}
            onChange={(event) =>
              setDiscount(Math.max(0, Number(event.target.value) || 0))
            }
            className="mt-1 h-8 text-xs"
            placeholder="0"
          />
        </div>
        <div className="col-span-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[11px] text-slate-500">GST (%)</Label>
            <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
              {(["exclusive", "inclusive"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGstMode(mode)}
                  className={`rounded px-2 py-1 text-[10px] font-semibold transition-colors ${
                    gstMode === mode
                      ? "bg-white text-red-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {mode === "exclusive" ? "Excluding GST" : "Including GST"}
                </button>
              ))}
            </div>
          </div>
          <Input
            type="number"
            min="0"
            max="100"
            value={gst}
            onChange={(event) =>
              setGst(Math.min(100, Math.max(0, Number(event.target.value) || 0)))
            }
            className="mt-1 h-8 text-xs"
            placeholder="18"
          />
        </div>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3">
        <div className="flex justify-between text-sm text-slate-500">
          <span>Subtotal + labor{gstMode === "inclusive" ? " (GST included)" : ""}</span>
          <span>{money(subtotalWithLabor)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm text-red-600">
            <span>Discount</span>
            <span>- {money(discount)}</span>
          </div>
        )}
        {(discount > 0 || gstMode === "inclusive") && (
          <div className="flex justify-between text-sm text-slate-500">
            <span>Taxable subtotal (before GST)</span>
            <span>{money(taxableSubtotal)}</span>
          </div>
        )}
        {gst > 0 && (
          <>
            <div className="flex justify-between text-sm text-slate-500">
              <span>SGST ({(gst / 2).toFixed(2)}%) · {gstModeLabel}</span>
              <span>₹{formatGstAmount(sgstAmount)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-500">
              <span>CGST ({(gst / 2).toFixed(2)}%) · {gstModeLabel}</span>
              <span>₹{formatGstAmount(cgstAmount)}</span>
            </div>
          </>
        )}
        <div className="flex items-end justify-between border-t border-slate-200 pt-2">
          <span className="font-bold text-slate-700">Total</span>
          <span className="text-xl font-black text-red-600">{money(total)}</span>
        </div>
      </div>

    </>
  );

  const renderReceipt = () => (
    <div className="pos-receipt-content w-full bg-white px-3 py-4 font-mono text-[10px] leading-tight text-black">
      <div className="text-center">
        <p className="text-base font-black tracking-wide">AUTO GAMMA</p>
        <p className="mt-0.5 text-[9px] uppercase tracking-[0.18em]">Sales Receipt</p>
        <p className="mt-1 text-[9px]">
          {new Date().toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>

      <div className="my-3 border-y border-dashed border-black py-2">
        <div className="flex justify-between gap-2">
          <span className="font-bold">Customer</span>
          <span className="max-w-[58%] text-right">{customer.name || "Walk-in customer"}</span>
        </div>
        {customer.phone && (
          <div className="mt-1 flex justify-between gap-2">
            <span>Phone</span>
            <span>{customer.phone}</span>
          </div>
        )}
        {(vehicle.make || vehicle.model || vehicle.licensePlate) && (
          <div className="mt-1 flex justify-between gap-2">
            <span>Vehicle</span>
            <span className="max-w-[62%] text-right">
              {[vehicle.make, vehicle.model, vehicle.licensePlate].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {cart.length === 0 ? (
          <p className="py-5 text-center">No items added</p>
        ) : (
          cart.map((item) => (
            <div key={`receipt-${item.cartId}`} className="border-b border-dotted border-black pb-1.5">
              <div className="flex justify-between gap-2 font-bold">
                <span className="min-w-0 break-words">{item.name}</span>
                <span className="shrink-0">{money(item.price * item.quantity)}</span>
              </div>
              {item.warranty && (
                <div className="mt-0.5 text-[9px] font-bold">
                  Warranty: {item.warranty}
                </div>
              )}
              <div className="mt-0.5 flex justify-between gap-2 text-[9px]">
                <span>
                  {item.quantity} × {money(item.price)} · {item.business}
                </span>
                <span>{item.type}</span>
              </div>
            </div>
          ))
        )}
        {laborCharge > 0 && (
          <div className="flex justify-between gap-2">
            <span>Labor · {laborBusiness}</span>
            <span>{money(laborCharge)}</span>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1 border-t border-black pt-2">
        <div className="flex justify-between gap-2">
          <span>Subtotal{gstMode === "inclusive" ? " (GST included)" : ""}</span>
          <span>{money(subtotalWithLabor)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between gap-2">
            <span>Discount</span>
            <span>- {money(discount)}</span>
          </div>
        )}
        {(discount > 0 || gstMode === "inclusive") && (
          <div className="flex justify-between gap-2">
            <span>Taxable subtotal (before GST)</span>
            <span>{money(taxableSubtotal)}</span>
          </div>
        )}
        {gst > 0 && (
          <>
            <div className="flex justify-between gap-2">
              <span>SGST ({(gst / 2).toFixed(2)}%) · {gstModeLabel}</span>
              <span>₹{formatGstAmount(sgstAmount)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span>CGST ({(gst / 2).toFixed(2)}%) · {gstModeLabel}</span>
              <span>₹{formatGstAmount(cgstAmount)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between gap-2 border-t border-black pt-1 text-sm font-black">
          <span>TOTAL</span>
          <span>{money(total)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Paid</span>
          <span>{money(totalPaid)}</span>
        </div>
        <div className="flex justify-between gap-2 font-bold">
          <span>Balance Due</span>
          <span>{money(remainingPayment)}</span>
        </div>
      </div>

      <div className="mt-3 border-t border-dashed border-black pt-2">
        <p className="font-bold">Payments</p>
        {payments.filter((payment) => Number(payment.amount) > 0).length > 0 ? (
          payments
            .filter((payment) => Number(payment.amount) > 0)
            .map((payment, index) => (
              <div key={`receipt-payment-${index}`} className="mt-1 flex justify-between gap-2">
                <span>{payment.method}</span>
                <span>{money(Number(payment.amount) || 0)}</span>
              </div>
            ))
        ) : (
          <p className="mt-1">Payment pending</p>
        )}
      </div>

      <p className="mt-4 text-center text-[9px]">Thank you for choosing Auto Gamma</p>
    </div>
  );

  const buildReceiptText = (job: any) => {
    const width = 48;
    const ESC = "\x1b";
    const center = `${ESC}a\x01`;
    const left = `${ESC}a\x00`;
    const boldOn = `${ESC}E\x01`;
    const boldOff = `${ESC}E\x00`;
    const divider = "-".repeat(width);
    const receiptMoney = (value: number) =>
      `Rs.${Math.max(0, Math.round(value)).toLocaleString("en-IN")}`;
    const receiptGstMoney = (value: number) => `Rs.${formatGstAmount(value)}`;
    const row = (label: string, value: string) => {
      const available = Math.max(1, width - value.length - 1);
      return `${label.slice(0, available).padEnd(available)} ${value}`;
    };
    const invoiceNumbers = Array.isArray(job?.invoiceNumbers)
      ? job.invoiceNumbers.filter(Boolean).join(", ")
      : "";
    const paymentsText = payments
      .filter((payment) => Number(payment.amount) > 0)
      .map((payment) => row(payment.method, receiptMoney(Number(payment.amount))))
      .join("\n");

    const itemText = cart
      .map((item) => {
        const itemTotal = item.price * item.quantity;
        return [
          item.name.slice(0, width),
          item.warranty ? `Warranty: ${item.warranty}` : "",
          `${item.quantity} x ${receiptMoney(item.price)}  ${item.business}`,
          row("Item total", receiptMoney(itemTotal)),
        ].filter(Boolean).join("\n");
      })
      .join("\n");

    return [
      center,
      boldOn,
      "AUTO GAMMA",
      boldOff,
      "SALES RECEIPT",
      new Date().toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      left,
      divider,
      row("Job card", String(job?.jobNo || "N/A")),
      invoiceNumbers ? row("Invoice", invoiceNumbers) : "",
      row("Customer", customer.name || "Walk-in customer"),
      customer.phone ? row("Phone", customer.phone) : "",
      vehicle.licensePlate ? row("Vehicle", vehicle.licensePlate) : "",
      vehicle.make || vehicle.model
        ? row("Model", [vehicle.make, vehicle.model].filter(Boolean).join(" "))
        : "",
      divider,
      itemText,
      laborCharge > 0 ? row(`Labor (${laborBusiness})`, receiptMoney(laborCharge)) : "",
      divider,
      row(
        `Subtotal${gstMode === "inclusive" ? " (GST included)" : ""}`,
        receiptMoney(subtotalWithLabor),
      ),
      discount > 0 ? row("Discount", `- ${receiptMoney(discount)}`) : "",
      discount > 0 || gstMode === "inclusive"
        ? row("Taxable subtotal (before GST)", receiptMoney(taxableSubtotal))
        : "",
      gst > 0
        ? row(`SGST ${(gst / 2).toFixed(2)}% · ${gstModeLabel}`, receiptGstMoney(sgstAmount))
        : "",
      gst > 0
        ? row(`CGST ${(gst / 2).toFixed(2)}% · ${gstModeLabel}`, receiptGstMoney(cgstAmount))
        : "",
      `${boldOn}${row("TOTAL", receiptMoney(total))}${boldOff}`,
      row("Paid", receiptMoney(totalPaid)),
      row("Balance due", receiptMoney(remainingPayment)),
      divider,
      paymentsText ? `Payments\n${paymentsText}` : "Payment pending",
      "",
      center,
      "Thank you for choosing Auto Gamma",
      "\n\n",
      left,
    ]
      .filter((line) => line !== "")
      .join("\n");
  };

  const retryPendingReceipt = async () => {
    if (!pendingReceipt || isRetryingPrint) return;

    setIsRetryingPrint(true);
    try {
      const printer = await printRawReceipt(pendingReceipt);
      setPendingReceipt(null);
      toast({
        title: "Receipt printed",
        description: `Sent to ${printer}.`,
      });
      setLocation("/invoice");
    } catch (error: any) {
      toast({
        title: "Receipt still not printed",
        description: error?.message || "Check that QZ Tray and the POS printer are ready.",
        variant: "destructive",
      });
    } finally {
      setIsRetryingPrint(false);
    }
  };

  const renderPaymentPanel = () => (
    <div className="shrink-0 border-t border-slate-200 bg-white p-3">
      <div className="space-y-3">
          <div>
            <p className="text-sm font-bold text-slate-800">Mark as Paid</p>
          </div>

          <div className="rounded-lg border border-red-100 bg-red-50 p-2.5">
            <div className="flex items-center justify-between gap-2 text-red-700">
              <span className="text-[10px] font-bold uppercase tracking-wide">
                Total Invoice Amount
              </span>
              <span className="text-base font-black">{money(total)}</span>
            </div>
            <div className="mt-2 space-y-1 border-t border-red-100 pt-2 text-[10px] text-slate-500">
              <div className="flex justify-between">
                <span>Subtotal + labor{gstMode === "inclusive" ? " (GST included)" : ""}</span>
                <span>{money(subtotalWithLabor)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span>
                  <span>- {money(discount)}</span>
                </div>
              )}
              {(discount > 0 || gstMode === "inclusive") && (
                <div className="flex justify-between">
                  <span>Taxable subtotal (before GST)</span>
                  <span>{money(taxableSubtotal)}</span>
                </div>
              )}
              {gst > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>SGST ({(gst / 2).toFixed(2)}%) · {gstModeLabel}</span>
                    <span>₹{formatGstAmount(sgstAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CGST ({(gst / 2).toFixed(2)}%) · {gstModeLabel}</span>
                    <span>₹{formatGstAmount(cgstAmount)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-red-100 pt-2 text-right">
              <div>
                <span className="block text-[9px] font-bold uppercase text-slate-400">
                  Total Paid
                </span>
                <span className="text-xs font-bold text-slate-700">{money(totalPaid)}</span>
              </div>
              <div>
                <span className="block text-[9px] font-bold uppercase text-slate-400">
                  Remaining
                </span>
                <span
                  className={`text-xs font-bold ${
                    remainingPayment > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {money(remainingPayment)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-800">Payment Details</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddPayment}
              className="h-7 px-2 text-[10px]"
            >
              Add Payment Method
            </Button>
          </div>

          <div className="max-h-40 space-y-3 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {payments.map((payment, index) => (
              <div key={index} className="space-y-2 rounded-md bg-slate-50 p-2.5">
                {activeBusinesses.length > 1 && (
                  <div>
                    <Label className="text-[9px] font-bold uppercase text-slate-400">
                      Business
                    </Label>
                    <select
                      value={payment.business || activeBusinesses[0]}
                      onChange={(event) =>
                        handlePaymentChange(
                          index,
                          "business",
                          event.target.value,
                        )
                      }
                      className="mt-1 h-8 w-full rounded-md border border-input bg-white px-2 text-[10px] outline-none focus:ring-2 focus:ring-ring"
                    >
                      {activeBusinesses.map((business) => (
                        <option key={business} value={business}>
                          {business}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[9px] font-bold uppercase text-slate-400">
                      Method
                    </Label>
                    <select
                      value={payment.method}
                      onChange={(event) =>
                        handlePaymentChange(index, "method", event.target.value)
                      }
                      className="mt-1 h-8 w-full rounded-md border border-input bg-white px-2 text-[10px] outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI / GPay">UPI / GPay</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-[9px] font-bold uppercase text-slate-400">
                      Date
                    </Label>
                    <Input
                      type="date"
                      value={payment.date}
                      onChange={(event) =>
                        handlePaymentChange(index, "date", event.target.value)
                      }
                      className="mt-1 h-8 text-[10px]"
                    />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Label className="text-[9px] font-bold uppercase text-slate-400">
                      Amount
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={payment.amount}
                      onChange={(event) =>
                        handlePaymentChange(index, "amount", event.target.value)
                      }
                      placeholder="0"
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                  {payments.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemovePayment(index)}
                      className="h-8 w-8 text-slate-300 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
      </div>
    </div>
  );

  return (
    <Layout hideTopbar fullScreen>
      <div className="flex h-full min-h-0 flex-col">
        <div className="grid min-h-0 flex-1 gap-2 bg-white xl:grid-cols-[minmax(0,1fr)_290px_400px] 2xl:grid-cols-[minmax(0,1fr)_320px_440px]">
          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-white p-1 md:p-2">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {editJobId && (
                <div className="order-first rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 lg:order-none">
                  {editingJobLoading
                    ? "Loading job card..."
                    : `Editing ${editingJob?.jobNo || "POS job card"}`}
                </div>
              )}
              <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("accessories");
                    setSearch("");
                    setWarrantySelection(null);
                  }}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                    activeSection === "accessories"
                      ? "bg-white text-red-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Package className="h-4 w-4" />
                  Accessories
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("services");
                    setSearch("");
                    setWarrantySelection(null);
                  }}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                    activeSection === "services"
                      ? "bg-white text-red-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Wrench className="h-4 w-4" />
                  Services
                </button>
              </div>
              <div className="relative w-full lg:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${activeSection}...`}
                  className="h-11 rounded-xl pl-9"
                />
                {search && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    onClick={() => setSearch("")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {activeSection === "accessories" && (
              <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                {accessoryCategories.map((category) => (
                  <button
                    type="button"
                    key={category}
                    onClick={() => setAccessoryCategory(category)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      accessoryCategory === category
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:text-red-600"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}

            {activeSection === "services" && !vehicle.type ? (
              <div className="mt-5 flex min-h-56 flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-amber-800">
                <Car className="mb-2 h-6 w-6" />
                <p className="text-sm font-bold">Vehicle type required</p>
                <p className="mt-1 text-xs">
                  Select a vehicle type before choosing services.
                </p>
                <div className="relative mt-4 w-full max-w-xs">
                  <select
                    aria-label="Select vehicle type before choosing services"
                    value={vehicle.type}
                    onChange={(event) =>
                      setVehicle({ ...vehicle, type: event.target.value })
                    }
                    className="h-10 w-full appearance-none rounded-md border border-amber-300 bg-white px-3 pr-9 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">Select vehicle type</option>
                    {vehicleTypes.map((type) => (
                      <option key={type.id || type.name} value={type.name}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 min-h-0 flex-1 content-start grid grid-cols-1 gap-x-2 gap-y-1 overflow-y-auto pb-1 sm:grid-cols-2 lg:grid-cols-3">
                  {activeSection === "services" &&
                    (servicesLoading
                      ? Array.from({ length: 6 }).map((_, index) => (
                          <div
                            key={index}
                            className="h-[154px] animate-pulse rounded-2xl bg-slate-100"
                          />
                        ))
                      : visibleServices.map((service) =>
                          renderProductCard(service, "Service"),
                        ))}
                  {activeSection === "accessories" &&
                    (accessoriesLoading
                      ? Array.from({ length: 6 }).map((_, index) => (
                          <div
                            key={index}
                            className="h-[154px] animate-pulse rounded-2xl bg-slate-100"
                          />
                        ))
                      : visibleAccessories.map((accessory) =>
                          renderProductCard(accessory, "Accessory"),
                        ))}
                </div>
                {((activeSection === "services" && !servicesLoading && visibleServices.length === 0) ||
                  (activeSection === "accessories" &&
                    !accessoriesLoading &&
                    visibleAccessories.length === 0)) && (
                  <div className="flex min-h-48 flex-col items-center justify-center text-center text-slate-400">
                    <Grid2X2 className="mb-3 h-8 w-8" />
                    <p className="font-semibold">No items found</p>
                    <p className="mt-1 text-sm">Try another search or category.</p>
                  </div>
                )}
              </>
            )}
          </section>

          <aside className="flex min-h-0 flex-col overflow-hidden border-l border-slate-200 bg-white pl-2">
            <div className="border-b border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CircleUserRound className="h-4 w-4 text-red-600" />
                  <h2 className="text-sm font-extrabold text-slate-900">Customer & Vehicle</h2>
                </div>
                {isLoadingCustomer && (
                  <span className="text-[10px] font-semibold text-slate-400">Looking up...</span>
                )}
              </div>
              <div className="mt-2 grid gap-2">
                <div>
                  <Label className="text-[11px] text-slate-500">Phone *</Label>
                  <Input
                    value={customer.phone}
                    maxLength={10}
                    onChange={(event) =>
                      setCustomer({
                        ...customer,
                        phone: event.target.value.replace(/\D/g, ""),
                      })
                    }
                    placeholder="10 digit number"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Customer name *</Label>
                  <Input
                    value={customer.name}
                    onChange={(event) =>
                      setCustomer({ ...customer, name: event.target.value })
                    }
                    placeholder="Enter customer name"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Email</Label>
                  <Input
                    value={customer.email}
                    onChange={(event) =>
                      setCustomer({ ...customer, email: event.target.value })
                    }
                    placeholder="Optional email"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div className="space-y-2 pt-1">
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={hasGst}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setHasGst(checked);
                        if (!checked) {
                          setCustomer((current) => ({ ...current, gstNumber: "" }));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-red-600"
                    />
                    Customer has GST number
                  </label>
                  {hasGst && (
                    <Input
                      value={customer.gstNumber}
                      onChange={(event) =>
                        setCustomer({
                          ...customer,
                          gstNumber: event.target.value.toUpperCase(),
                        })
                      }
                      placeholder="Enter GST number (e.g. 27AAPFU0939F1ZV)"
                      className="h-8 text-xs"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-red-600" />
                <h2 className="text-sm font-extrabold text-slate-900">Vehicle information</h2>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-slate-500">Make *</Label>
                  <Input
                    value={vehicle.make}
                    onChange={(event) =>
                      setVehicle({ ...vehicle, make: event.target.value })
                    }
                    placeholder="Toyota"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Model *</Label>
                  <Input
                    value={vehicle.model}
                    onChange={(event) =>
                      setVehicle({ ...vehicle, model: event.target.value })
                    }
                    placeholder="Fortuner"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Registration *</Label>
                  <Input
                    value={vehicle.licensePlate}
                    onChange={(event) =>
                      setVehicle({
                        ...vehicle,
                        licensePlate: formatRegistration(event.target.value),
                      })
                    }
                    maxLength={13}
                    placeholder="MH 01 AB 1234"
                    className={`mt-1 h-8 text-xs ${
                      vehicle.licensePlate &&
                      !isValidRegistration(vehicle.licensePlate)
                        ? "border-amber-500 ring-1 ring-amber-400 bg-amber-50"
                        : ""
                    }`}
                  />
                  {vehicle.licensePlate &&
                    !isValidRegistration(vehicle.licensePlate) && (
                      <p className="mt-1 text-[10px] font-semibold text-amber-700">
                        Use format MH 01 AD 7898 or YY BH 0000 AA.
                      </p>
                    )}
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Year</Label>
                  <Input
                    inputMode="numeric"
                    maxLength={4}
                    value={vehicle.year}
                    onChange={(event) =>
                      setVehicle({
                        ...vehicle,
                        year: event.target.value.replace(/\D/g, "").slice(0, 4),
                      })
                    }
                    placeholder="2024"
                    className={`mt-1 h-8 text-xs ${
                      vehicle.year && !/^\d{4}$/.test(vehicle.year)
                        ? "border-amber-500 ring-1 ring-amber-400 bg-amber-50"
                        : ""
                    }`}
                  />
                  {vehicle.year && !/^\d{4}$/.test(vehicle.year) && (
                    <p className="mt-1 text-[10px] font-semibold text-amber-700">
                      Year must contain exactly 4 numbers.
                    </p>
                  )}
                </div>
                <div className="col-span-2">
                  <Label className="text-[11px] text-slate-500">Vehicle type *</Label>
                  <div className="relative mt-1">
                    <select
                      aria-invalid={!vehicle.type}
                      value={vehicle.type}
                      onChange={(event) =>
                        setVehicle({ ...vehicle, type: event.target.value })
                      }
                      className={`h-8 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-xs outline-none focus:ring-2 focus:ring-ring ${
                        !vehicle.type
                          ? "border-amber-400 bg-amber-50 ring-1 ring-amber-200"
                          : "border-input"
                      }`}
                    >
                      <option value="">Select vehicle type</option>
                      {vehicleTypes.map((type) => (
                        <option key={type.id || type.name} value={type.name}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-2 h-4 w-4 text-slate-400" />
                  </div>
                  {!vehicle.type && (
                    <p className="mt-1 text-[10px] font-semibold text-amber-700">
                      Required before selecting services.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-3 pb-3">
              {renderBillingPanel()}
            </div>
          </aside>

          <aside className="flex min-h-0 flex-col overflow-hidden border-l border-slate-200 bg-white pl-2">
            <div className="shrink-0 border-b border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-red-600" />
                  <h2 className="text-sm font-extrabold text-slate-900">Current order</h2>
                  <Badge variant="secondary">{itemCount}</Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowReceiptPreview(true)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-1.5 text-[10px] font-bold text-slate-600 transition hover:border-red-200 hover:text-red-600"
                    title="Preview 80mm receipt"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    80mm
                  </button>
                  <button
                    type="button"
                    onClick={() => qzCheckMutation.mutate()}
                    disabled={qzCheckMutation.isPending}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-1.5 text-[10px] font-bold text-slate-600 transition hover:border-red-200 hover:text-red-600 disabled:cursor-wait disabled:opacity-60"
                    title="Check QZ Tray and local printers"
                  >
                    {qzCheckMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Printer className="h-3.5 w-3.5" />
                    )}
                    QZ
                  </button>
                  <span className="text-[10px] font-bold text-slate-500">Print</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={printOnComplete}
                    aria-label="Print receipt after completing sale"
                    onClick={() => setPrintOnComplete((current) => !current)}
                    className={`relative h-5 w-9 rounded-full transition ${
                      printOnComplete ? "bg-red-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                        printOnComplete ? "left-[18px]" : "left-0.5"
                      }`}
                    />
                  </button>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="ml-1 text-xs font-bold text-red-600 hover:text-red-700"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {cart.length === 0 ? (
                <div className="flex min-h-32 flex-col items-center justify-center border-y border-dashed border-slate-300 bg-white px-4 text-center">
                  <ShoppingCart className="mb-2 h-7 w-7 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-500">Cart is empty</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Add a service or accessory to begin.
                  </p>
                </div>
              ) : (
                <div className="space-y-0">
                  {cart.map((item) => (
                    <div
                      key={item.cartId}
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 border-b border-slate-200 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {item.name}
                        </p>
                        {item.warranty && (
                          <p className="truncate text-[10px] font-semibold text-red-600">
                            Warranty: {item.warranty}
                          </p>
                        )}
                        {item.type === "Service" && (
                          <div className="mt-1.5 min-w-0">
                            <Label className="text-[9px] font-semibold text-slate-500">
                              HSN Code{" "}
                              <span className="font-normal text-slate-400">
                                (Optional)
                              </span>
                            </Label>
                            <div className="mt-0.5">
                              <HsnCombobox
                                compact
                                value={item.hsnCode || ""}
                                onChange={(value) =>
                                  changeItemHsn(item.cartId, value)
                                }
                                placeholder="Search or enter HSN..."
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="row-span-2 flex shrink-0 items-center rounded-lg border border-slate-200 bg-white">
                        <button
                          type="button"
                          className="p-1.5 text-slate-500 hover:text-red-600"
                          onClick={() => changeQuantity(item.cartId, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-6 text-center text-xs font-bold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="p-1.5 text-slate-500 hover:text-red-600 disabled:opacity-30"
                          disabled={item.stock !== undefined && item.quantity >= item.stock}
                          onClick={() => changeQuantity(item.cartId, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="row-span-2 flex w-20 shrink-0 flex-col items-end justify-center">
                        <p className="text-sm font-extrabold text-slate-800">
                          {money(item.price * item.quantity)}
                        </p>
                        <button
                          type="button"
                          className="mt-1 text-slate-400 hover:text-red-600"
                          onClick={() =>
                            setCart((current) =>
                              current.filter((cartItem) => cartItem.cartId !== item.cartId),
                            )
                          }
                        >
                          <Trash2 className="ml-auto h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <select
                          aria-label={`Invoice business for ${item.name}`}
                          value={item.business}
                          onChange={(event) =>
                            changeItemBusiness(
                              item.cartId,
                              event.target.value as PosItem["business"],
                            )
                          }
                          className="h-6 w-[110px] shrink-0 rounded border border-slate-200 bg-white px-1.5 text-[10px] font-semibold text-slate-600 outline-none focus:ring-1 focus:ring-red-300"
                        >
                          <option value="Auto Gamma">Auto Gamma</option>
                          <option value="AGNX">AGNX</option>
                        </select>
                        <span className="shrink-0 whitespace-nowrap text-[10px] font-medium text-slate-500">
                          {money(item.price)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>

            {renderPaymentPanel()}

            <div className="border-t border-slate-200 bg-slate-50 p-3">
              {pendingReceipt && (
                <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                  <p className="text-xs font-bold text-amber-900">
                    Sale saved. Receipt is waiting to be printed.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={retryPendingReceipt}
                      disabled={isRetryingPrint}
                      className="h-8 flex-1 bg-amber-600 text-xs font-bold hover:bg-amber-700"
                    >
                      {isRetryingPrint ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Printer className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Retry receipt
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setLocation("/invoice")}
                      className="h-8 text-xs font-bold"
                    >
                      View invoice
                    </Button>
                  </div>
                </div>
              )}
              <Button
                className="h-10 w-full gap-2 rounded-xl bg-red-600 text-sm font-extrabold hover:bg-red-700"
                disabled={checkoutMutation.isPending || cart.length === 0}
                onClick={() => checkoutMutation.mutate()}
              >
                <Check className="h-4 w-4" />
                {checkoutMutation.isPending
                  ? editJobId
                    ? "Updating sale..."
                    : "Saving sale..."
                  : editJobId
                    ? `Update sale · ${money(total)}`
                    : `Complete sale · ${money(total)}`}
              </Button>
              <p className="mt-1 text-center text-[10px] text-slate-400">
                {editJobId
                  ? "This updates the existing POS job card and invoice."
                  : "This creates a completed job card and saves the invoice."}
              </p>
            </div>
          </aside>
        </div>
        <div className="pos-print-receipt" aria-hidden="true">
          {renderReceipt()}
        </div>
      </div>
      {showReceiptPreview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="80mm receipt preview"
          onClick={() => setShowReceiptPreview(false)}
        >
          <div
            className="max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-auto rounded-xl bg-slate-100 p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-900">80mm Receipt Preview</p>
                <p className="text-[10px] text-slate-500">Thermal printer layout</p>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptPreview(false)}
                className="rounded-md px-2 py-1 text-xs font-bold text-slate-500 hover:bg-white hover:text-slate-900"
              >
                Close
              </button>
            </div>
            <div className="mx-auto w-[80mm] max-w-full overflow-hidden bg-white shadow-lg">
              {renderReceipt()}
            </div>
          </div>
        </div>
      )}
      <Dialog
        open={Boolean(warrantySelection)}
        onOpenChange={(open) => {
          if (!open) setWarrantySelection(null);
        }}
      >
        <DialogContent className="max-w-md overflow-hidden rounded-2xl border-red-100 bg-white p-0 shadow-2xl">
          {warrantySelection && (
            <>
              <DialogHeader className="border-b border-red-100 bg-red-50 px-5 py-4 pr-12 text-left">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-red-600">
                  Warranty options
                </p>
                <DialogTitle className="mt-1 text-base font-extrabold text-slate-900">
                  {warrantySelection.service.name}
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-slate-500">
                  Choose a warranty option to add this service to the order.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 p-4">
                {warrantySelection.options.map((option) => (
                  <button
                    key={option.warrantyName}
                    type="button"
                    onClick={() => {
                      addServiceToCart(warrantySelection.service, option);
                      setWarrantySelection(null);
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                  >
                    <span className="text-sm font-bold text-slate-800">
                      {option.warrantyName}
                    </span>
                    <span className="text-sm font-extrabold text-red-600">
                      {money(Number(option.price))}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}