import { Layout } from "@/components/layout/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { api } from "@shared/routes";
import { AccessoryMaster, ServiceMaster } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Car,
  Check,
  ChevronDown,
  CircleUserRound,
  CreditCard,
  Grid2X2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type PosItem = {
  cartId: string;
  id: string;
  name: string;
  price: number;
  type: "Service" | "Accessory";
  business: "Auto Gamma" | "AGNX";
  category?: string;
  quantity: number;
  stock?: number;
  hsnCode?: string;
};

type PosPayment = {
  amount: string;
  method: string;
  date: string;
};

const money = (value: number) =>
  `₹${Math.max(0, Math.round(value)).toLocaleString("en-IN")}`;

function getServicePrice(service: ServiceMaster, vehicleType: string) {
  const pricing = (service.pricingByVehicleType || []).find(
    (entry: any) => entry.vehicleType === vehicleType,
  ) as any;

  if (!pricing) return 0;
  return Number(pricing.price || pricing.warrantyOptions?.[0]?.price || 0);
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

export default function PosPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<"services" | "accessories">(
    "services",
  );
  const [search, setSearch] = useState("");
  const [accessoryCategory, setAccessoryCategory] = useState("All");
  const [cart, setCart] = useState<PosItem[]>([]);
  const [laborCharge, setLaborCharge] = useState(0);
  const [laborBusiness, setLaborBusiness] = useState<"Auto Gamma" | "AGNX">("Auto Gamma");
  const [discount, setDiscount] = useState(0);
  const [gst, setGst] = useState(18);
  const [markAsPaid, setMarkAsPaid] = useState(false);
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
  const [vehicle, setVehicle] = useState({
    make: "",
    model: "",
    year: "",
    licensePlate: "",
    type: "",
  });
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);

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

        const savedVehicle =
          savedCustomer.vehicles?.[0] || savedCustomer;
        if (savedVehicle) {
          setVehicle((current) => ({
            ...current,
            make: savedVehicle.make || current.make,
            model: savedVehicle.model || current.model,
            year: savedVehicle.year || current.year,
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
  const total = afterDiscount;
  const taxableSubtotal =
    gst > 0 ? afterDiscount / (1 + gst / 100) : afterDiscount;
  const gstAmount = afterDiscount - taxableSubtotal;
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
      const cleanMake = vehicle.make.trim();
      const cleanModel = vehicle.model.trim();
      const cleanPlate = vehicle.licensePlate.trim();

      if (!cleanName || !cleanPhone || !cleanMake || !cleanModel || !cleanPlate) {
        throw new Error(
          "Customer name, phone, make, model, and registration number are required.",
        );
      }
      if (cart.length === 0) throw new Error("Add at least one service or accessory.");

      const normalizedPayments = markAsPaid
        ? payments.map((payment) => ({
            amount: Number(payment.amount) || 0,
            method: payment.method,
            date: payment.date,
          }))
        : [];
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

      const servicesPayload = cart
        .filter((item) => item.type === "Service")
        .map((item) => ({
          id: item.id,
          serviceId: item.id,
          name: item.name,
          price: item.price,
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
      const businessTotalsAfterDiscount = {
        "Auto Gamma": Math.max(
          0,
          businessSubtotals["Auto Gamma"] - businessDiscounts["Auto Gamma"],
        ),
        AGNX: Math.max(0, businessSubtotals.AGNX - businessDiscounts.AGNX),
      };
      const activeBusinesses = (["Auto Gamma", "AGNX"] as const).filter(
        (businessName) => businessTotalsAfterDiscount[businessName] > 0,
      );
      let paymentRemaining = receivedAmount;
      const perBusinessPayments =
        activeBusinesses.length > 1
          ? Object.fromEntries(
              activeBusinesses
          .map((businessName) => {
            const amount = Math.min(
              paymentRemaining,
              businessTotalsAfterDiscount[businessName],
            );
            paymentRemaining = Math.max(0, paymentRemaining - amount);
            const payment = normalizedPayments.find((entry) => entry.amount > 0) ||
              normalizedPayments[0] || {
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

      const response = await apiRequest("POST", "/api/job-cards", {
        customerName: cleanName,
        phoneNumber: cleanPhone,
        emailAddress: customer.email.trim(),
        gstNumber: customer.gstNumber.trim(),
        referralSource: "POS",
        referrerName: "",
        referrerPhone: "",
        make: cleanMake,
        model: cleanModel,
        year: vehicle.year.trim(),
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
        serviceNotes: "Created from POS",
        status: "Completed",
        estimatedCost: total,
        technician: "",
        date: new Date().toISOString(),
        isPaid: markAsPaid,
        payments: normalizedPayments,
        perBusinessPayments,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: [api.masters.accessories.list.path] });
      toast({
        title: "Sale completed",
        description: "Job card and invoice were saved successfully.",
      });
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
    const price = service
      ? getServicePrice(service, vehicle.type)
      : Number(accessory?.price || 0);
    const stock = accessory?.quantity;
    const disabled = Boolean(
      (service && !vehicle.type) || (accessory && Number(stock) <= 0),
    );

    return (
      <button
        key={item.id}
        type="button"
        disabled={disabled}
        onClick={() =>
          addToCart({
            cartId: `${type}-${item.id}`,
            id: item.id || "",
            name: item.name,
            price,
            type,
            business: "Auto Gamma",
            category: accessory?.category,
            quantity: 1,
            stock: accessory?.quantity,
            hsnCode: item.hsnCode,
          })
        }
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
              {disabled && service && !vehicle.type ? "Select vehicle" : money(price)}
            </p>
            {accessory && (
              <p className="truncate text-[10px] leading-3 text-slate-400">
                {Number(stock) > 0 ? `${stock} in stock` : "Out of stock"}
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
          <Label className="text-[11px] text-slate-500">GST included (%)</Label>
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
          <span>Subtotal + labor</span>
          <span>{money(taxableSubtotal)}</span>
        </div>
        {gst > 0 && (
          <div className="flex justify-between text-sm text-slate-500">
            <span>GST ({gst}%)</span>
            <span>{money(gstAmount)}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-sm text-red-600">
            <span>Discount</span>
            <span>- {money(discount)}</span>
          </div>
        )}
        <div className="flex items-end justify-between border-t border-slate-200 pt-2">
          <span className="font-bold text-slate-700">Total</span>
          <span className="text-xl font-black text-red-600">{money(total)}</span>
        </div>
      </div>

    </>
  );

  const renderPaymentPanel = () => (
    <div className="border-t border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-800">Mark as Paid</p>
          <p className="text-[10px] text-slate-400">
            Has the customer already paid for this sale?
          </p>
        </div>
        <input
          type="checkbox"
          checked={markAsPaid}
          onChange={(event) => setMarkAsPaid(event.target.checked)}
          className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-600"
        />
      </div>

      {markAsPaid && (
        <div className="mt-3 max-h-64 space-y-3 overflow-y-auto">
          <div className="rounded-lg border border-red-100 bg-red-50 p-2.5">
            <div className="flex items-center justify-between gap-2 text-red-700">
              <span className="text-[10px] font-bold uppercase tracking-wide">
                Total Invoice Amount
              </span>
              <span className="text-base font-black">{money(total)}</span>
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

          {payments.map((payment, index) => (
            <div key={index} className="space-y-2 rounded-md bg-slate-50 p-2.5">
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
      )}
    </div>
  );

  return (
    <Layout hideTopbar fullScreen>
      <div className="flex h-full min-h-0 flex-col">
        <div className="grid min-h-0 flex-1 gap-2 bg-white xl:grid-cols-[minmax(0,1fr)_290px_340px] 2xl:grid-cols-[minmax(0,1fr)_320px_380px]">
          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-white p-1 md:p-2">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("services");
                    setSearch("");
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
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("accessories");
                    setSearch("");
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

            {activeSection === "services" && !vehicle.type && (
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <Car className="h-4 w-4 shrink-0" />
                Select a vehicle type on the right to load service pricing.
              </div>
            )}

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
                <div className="grid grid-cols-[1fr_0.85fr] gap-2">
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
                    <Label className="text-[11px] text-slate-500">GSTIN</Label>
                    <Input
                      value={customer.gstNumber}
                      onChange={(event) =>
                        setCustomer({ ...customer, gstNumber: event.target.value })
                      }
                      placeholder="Optional"
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
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
                      setVehicle({ ...vehicle, licensePlate: event.target.value })
                    }
                    placeholder="MH 01 AB 1234"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-500">Year</Label>
                  <Input
                    value={vehicle.year}
                    onChange={(event) =>
                      setVehicle({ ...vehicle, year: event.target.value })
                    }
                    placeholder="2024"
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-[11px] text-slate-500">Vehicle type *</Label>
                  <div className="relative mt-1">
                    <select
                      value={vehicle.type}
                      onChange={(event) =>
                        setVehicle({ ...vehicle, type: event.target.value })
                      }
                      className="h-8 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-xs outline-none focus:ring-2 focus:ring-ring"
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
                </div>
              </div>
            </div>

            <div className="px-3 pb-3">
              {renderBillingPanel()}
            </div>
          </aside>

          <aside className="flex min-h-0 flex-col overflow-hidden border-l border-slate-200 bg-white pl-2">
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-red-600" />
                  <h2 className="text-sm font-extrabold text-slate-900">Current order</h2>
                  <Badge variant="secondary">{itemCount}</Badge>
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs font-bold text-red-600 hover:text-red-700"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="flex min-h-32 flex-col items-center justify-center border-y border-dashed border-slate-300 bg-white px-4 text-center">
                  <ShoppingCart className="mb-2 h-7 w-7 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-500">Cart is empty</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Add a service or accessory to begin.
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {cart.map((item) => (
                    <div
                      key={item.cartId}
                      className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-700">
                          {item.name}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <select
                            aria-label={`Invoice business for ${item.name}`}
                            value={item.business}
                            onChange={(event) =>
                              changeItemBusiness(
                                item.cartId,
                                event.target.value as PosItem["business"],
                              )
                            }
                            className="h-5 max-w-[110px] rounded border border-slate-200 bg-white px-1 text-[10px] font-semibold text-slate-500 outline-none focus:ring-1 focus:ring-red-300"
                          >
                            <option value="Auto Gamma">Auto Gamma</option>
                            <option value="AGNX">AGNX</option>
                          </select>
                          <span className="truncate text-[10px] text-slate-400">
                            {money(item.price)} each
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center rounded-lg border border-slate-200 bg-white">
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
                      <div className="w-20 text-right">
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
                    </div>
                  ))}
                </div>
              )}

            </div>

            {renderPaymentPanel()}

            <div className="border-t border-slate-200 bg-slate-50 p-3">
              <Button
                className="h-10 w-full gap-2 rounded-xl bg-red-600 text-sm font-extrabold hover:bg-red-700"
                disabled={checkoutMutation.isPending || cart.length === 0}
                onClick={() => checkoutMutation.mutate()}
              >
                <Check className="h-4 w-4" />
                {checkoutMutation.isPending
                  ? "Saving sale..."
                  : `Complete sale · ${money(total)}`}
              </Button>
              <p className="mt-1 text-center text-[10px] text-slate-400">
                This creates a completed job card and saves the invoice.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}