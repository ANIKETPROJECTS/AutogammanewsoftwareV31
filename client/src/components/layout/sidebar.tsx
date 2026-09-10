import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Search, 
  ClipboardList, 
  PlusSquare, 
  FileCheck, 
  Wrench, 
  Users,
  Calendar, 
  Ticket, 
  Database,
  Settings, 
  LogOut,
  Building2,
  Wallet,
  BarChart2,
  Shield,
  ShoppingCart,
  MessageCircle,
  HandCoins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import logoImage from "@assets/logoAutogamma_1770051594473.png";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Search, label: "Inquiry", href: "/inquiry" },
  { icon: MessageCircle, label: "WhatsApp Inquiries", href: "/whatsapp-inquiries" },
  { icon: ClipboardList, label: "Job cards", href: "/job-cards" },
  { icon: PlusSquare, label: "Add Job", href: "/add-job" },
  { icon: ShoppingCart, label: "POS / New Sale", href: "/pos" },
  { icon: Users, label: "Customers", href: "/customers" },
  { icon: FileCheck, label: "Invoice", href: "/invoice" },
  { icon: Wrench, label: "Technicians", href: "/technicians" },
  { icon: HandCoins, label: "Employee Loans", href: "/employee-loans" },
  { icon: Calendar, label: "Appointment", href: "/appointments" },
  { icon: Ticket, label: "Tickets", href: "/tickets" },
  { icon: Database, label: "Old Customers", href: "/old-customers" },
  { icon: Database, label: "Masters", href: "/masters" },
  { icon: Building2, label: "Vendor Management", href: "/vendor-management" },
  { icon: Wallet, label: "Expenses", href: "/expenses" },
  { icon: BarChart2, label: "Analytics", href: "/analytics" },
  { icon: Shield, label: "Warranty", href: "/warranty" },
  { icon: ShoppingCart, label: "Resell", href: "/resell" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();

  return (
    <div className="h-screen w-20 bg-white border-r border-border flex flex-col fixed left-0 top-0 overflow-hidden z-50">
      <div className="flex h-16 items-center justify-center border-b border-border/50 px-2">
        <div className="flex items-center justify-center">
          <img 
            src={logoImage}
            alt="Auto Gamma Logo"
            className="h-8 w-auto"
          />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-hidden px-2 py-2">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              title={item.label}
              aria-label={item.label}
              className={cn(
                "mx-auto flex h-8 w-12 items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                location === item.href
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4", location === item.href ? "text-white" : "text-muted-foreground group-hover:text-primary")} />
            </div>
          </Link>
        ))}
      </nav>

      <div className="flex h-12 items-center justify-center border-t border-border px-2">
        <button 
          title="Sign Out"
          aria-label="Sign Out"
          onClick={() => logout()}
          className="flex h-8 w-12 items-center justify-center rounded-lg text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
