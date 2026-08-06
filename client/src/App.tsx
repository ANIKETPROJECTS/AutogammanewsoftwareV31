import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import AppointmentsPage from "@/pages/appointments";
import MastersPage from "@/pages/masters";
import AccessoryCategoryDetail from "@/pages/accessory-category-detail";
import TechniciansPage from "@/pages/technicians";
import SettingsPage from "@/pages/settings";
import InquiryPage from "@/pages/inquiry";
import InvoicePage from "@/pages/invoice";
import CustomersPage from "@/pages/customers";
import CustomerDetailPage from "@/pages/customer-detail";
import TicketsPage from "@/pages/tickets";
import OldCustomersPage from "@/pages/old-customers";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

// Protected Route Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

// Public Route Wrapper (redirects to dashboard if already logged in)
function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

import WhatsAppInquiriesPage from "@/pages/whatsapp-inquiries";
import AddJobPage from "@/pages/add-job";
import JobCardsPage from "@/pages/job-cards";
import JobDetailsPage from "@/pages/job-details";
import VendorManagementPage from "@/pages/vendor-management";
import ExpensesPage from "@/pages/expenses";
import AnalyticsPage from "@/pages/analytics";
import WarrantyPage from "@/pages/warranty";
import ResellPage from "@/pages/resell";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <PublicRoute component={LoginPage} />
      </Route>
      
      <Route path="/dashboard">
        <ProtectedRoute component={DashboardPage} />
      </Route>

      <Route path="/inquiry">
        <ProtectedRoute component={InquiryPage} />
      </Route>
      <Route path="/job-cards"><ProtectedRoute component={JobCardsPage} /></Route>
      <Route path="/job-cards/:id"><ProtectedRoute component={JobDetailsPage} /></Route>
      <Route path="/add-job"><ProtectedRoute component={AddJobPage} /></Route>
      <Route path="/customers"><ProtectedRoute component={CustomersPage} /></Route>
      <Route path="/customers/:phone"><ProtectedRoute component={CustomerDetailPage} /></Route>
      <Route path="/invoice"><ProtectedRoute component={InvoicePage} /></Route>
      <Route path="/invoice/:phone"><ProtectedRoute component={InvoicePage} /></Route>
      <Route path="/technicians"><ProtectedRoute component={TechniciansPage} /></Route>
      <Route path="/appointments"><ProtectedRoute component={AppointmentsPage} /></Route>
      <Route path="/tickets"><ProtectedRoute component={TicketsPage} /></Route>
      <Route path="/old-customers"><ProtectedRoute component={OldCustomersPage} /></Route>
      <Route path="/masters">
        <ProtectedRoute component={MastersPage} />
      </Route>
      <Route path="/masters/accessory-category/:id">
        <ProtectedRoute component={AccessoryCategoryDetail} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={SettingsPage} />
      </Route>

      <Route path="/vendor-management">
        <ProtectedRoute component={VendorManagementPage} />
      </Route>

      <Route path="/expenses">
        <ProtectedRoute component={ExpensesPage} />
      </Route>

      <Route path="/analytics">
        <ProtectedRoute component={AnalyticsPage} />
      </Route>

      <Route path="/warranty">
        <ProtectedRoute component={WarrantyPage} />
      </Route>

      <Route path="/resell">
        <ProtectedRoute component={ResellPage} />
      </Route>

      <Route path="/whatsapp-inquiries">
        <ProtectedRoute component={WhatsAppInquiriesPage} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
