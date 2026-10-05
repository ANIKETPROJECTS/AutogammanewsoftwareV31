import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { User as UserType, Shield, Mail, User as UserIcon, Save, RefreshCw, Database } from "lucide-react";
import { useState } from "react";
import { WhatsAppLiveChatSettings } from "@/components/settings/whatsapp-live-chat-settings";

function AdminTools() {
  const { toast } = useToast();
  const [migrationResult, setMigrationResult] = useState<string | null>(null);

  const migrateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/migrate-invoice-numbers", {});
      return res.json();
    },
    onSuccess: (data) => {
      setMigrationResult(data.message || "Done");
      toast({ title: "Migration complete", description: data.message });
    },
    onError: (e: any) => {
      toast({ title: "Migration failed", description: e?.message || "Error", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          Admin Tools
        </CardTitle>
        <CardDescription className="text-xs">
          Data maintenance utilities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="border rounded-md p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Re-number Invoices</p>
          <p className="text-xs text-muted-foreground">
            Converts all invoice numbers to the new <span className="font-mono bg-slate-100 px-1 rounded">AG-YYYY-MM-DD-NN</span> date-based format. Safe to run multiple times.
          </p>
          {migrationResult && (
            <p className="text-xs text-green-700 bg-green-50 rounded p-2 border border-green-100">{migrationResult}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs"
            onClick={() => {
              if (confirm("This will re-number all invoices. Continue?")) {
                setMigrationResult(null);
                migrateMutation.mutate();
              }
            }}
            disabled={migrateMutation.isPending}
            data-testid="btn-migrate-invoices"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${migrateMutation.isPending ? "animate-spin" : ""}`} />
            {migrateMutation.isPending ? "Running..." : "Run Migration"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const settingsSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      password: "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: SettingsFormValues) => {
      const payload = { ...data };
      if (!payload.password) delete payload.password;
      const res = await apiRequest("PATCH", "/api/user", payload);
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/user"], updatedUser);
      toast({ title: "Settings updated successfully" });
      form.reset({ ...updatedUser, password: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettingsFormValues) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your profile and account security</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-primary" />
                Profile Information
              </CardTitle>
              <CardDescription>Update your account details and contact information</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="John Doe" className="pl-9" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="admin@example.com" className="pl-9" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-4 border-t border-border">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      Security
                    </h3>
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem className="max-w-md">
                          <FormLabel>Change Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="••••••••"
                              {...field}
                            />
                          </FormControl>
                          <CardDescription className="mt-1">
                            Leave blank to keep your current password
                          </CardDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-6">
                    <Button 
                      type="submit" 
                      className="bg-primary hover:bg-primary/90 text-white gap-2 px-6"
                      disabled={updateProfileMutation.isPending}
                    >
                      <Save className="h-4 w-4" />
                      Save Changes
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Account Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground">Role</span>
                  <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">Administrator</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground">Member Since</span>
                  <span className="text-sm font-medium text-foreground">Jan 24, 2026</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground">Last Login</span>
                  <span className="text-sm font-medium text-foreground">Today</span>
                </div>
              </CardContent>
            </Card>

            <WhatsAppLiveChatSettings />
            <AdminTools />
          </div>
        </div>
      </div>
    </Layout>
  );
}
