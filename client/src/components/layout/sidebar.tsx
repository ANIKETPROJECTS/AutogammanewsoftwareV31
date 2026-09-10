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
  HandCoins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import logoImage from "@assets/logoAutogamma_1770051594473.png";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Search, label: "Inquiry", href: "/inquiry" },
  { icon: ClipboardList, label: "Jobs", href: "/job-cards" },
  { icon: PlusSquare, label: "Add", href: "/add-job" },
  { icon: ShoppingCart, label: "Sales", href: "/pos" },
  { icon: Users, label: "Customers", href: "/customers" },
  { icon: FileCheck, label: "Invoice", href: "/invoice" },
  { icon: Wrench, label: "Techs", href: "/technicians" },
  { icon: HandCoins, label: "Loans", href: "/employee-loans" },
  { icon: Calendar, label: "Calendar", href: "/appointments" },
  { icon: Ticket, label: "Tickets", href: "/tickets" },
  { icon: Database, label: "Masters", href: "/masters" },
  { icon: Building2, label: "Vendors", href: "/vendor-management" },
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
      <div className="flex h-14 items-center justify-center border-b border-border/50 px-2">
        <div className="flex items-center justify-center">
          <img 
            src={logoImage}
            alt="Auto Gamma Logo"
            className="h-auto max-w-[62px] object-contain"
          />
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-1.5 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              title={item.label}
              aria-label={item.label}
              className={cn(
                "mx-auto flex h-10 w-14 flex-col items-center justify-center gap-1 rounded-lg text-[9px] font-medium leading-none transition-all duration-200 cursor-pointer",
                location === item.href
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", location === item.href ? "text-white" : "text-muted-foreground group-hover:text-primary")} />
              <span className="max-w-full truncate px-0.5 text-center">{item.label}</span>
            </div>
          </Link>
        ))}
      </nav>

      <div className="flex h-10 items-center justify-center border-t border-border px-2">
        <button 
          title="Sign Out"
          aria-label="Sign Out"
          onClick={() => logout()}
          className="flex h-8 w-12 items-center justify-center rounded-lg text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
