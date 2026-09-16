import { Layout } from "@/components/layout/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { JobCard } from "@shared/schema";
import { Search, Plus, Calendar, User, Car, Settings, IndianRupee, X } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { format } from "date-fns";

export default function JobCardsPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Jobs");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: jobCards = [], isLoading } = useQuery<JobCard[]>({
    queryKey: ["/api/job-cards"],
  });

  const filteredJobs = jobCards
    .filter(job => {
      const matchesSearch = 
        job.jobNo.toLowerCase().includes(search.toLowerCase()) ||
        job.customerName.toLowerCase().includes(search.toLowerCase()) ||
        job.licensePlate.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === "All Jobs" || job.status === statusFilter;
      
      // Date filter
      let matchesDate = true;
      if (startDate || endDate) {
        const jobDate = new Date(job.date);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          matchesDate = matchesDate && jobDate >= start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          matchesDate = matchesDate && jobDate <= end;
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    })
    .sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return b.jobNo.localeCompare(a.jobNo, undefined, { numeric: true });
    });

  const statusCounts = {
    "All Jobs": jobCards.length,
    "Pending": jobCards.filter(j => j.status === "Pending").length,
    "In Progress": jobCards.filter(j => j.status === "In Progress").length,
    "Completed": jobCards.filter(j => j.status === "Completed").length,
    "Cancelled": jobCards.filter(j => j.status === "Cancelled").length,
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Job Cards</h1>
            <p className="text-muted-foreground">Manage and track all service jobs</p>
          </div>
          <Button onClick={() => setLocation("/add-job")} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" /> New Job Card
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by job #, customer, vehicle..." 
              className="pl-10 h-11"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                placeholder="From Date"
                className="pl-10 h-11"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                placeholder="To Date"
                className="pl-10 h-11"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {(startDate || endDate) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="h-11"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "outline"}
              onClick={() => setStatusFilter(status)}
              className={`h-9 whitespace-nowrap ${statusFilter === status ? "bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200" : ""}`}
            >
              {status} <span className="ml-2 text-xs opacity-60">{count}</span>
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-64 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredJobs.map((job) => (
              <Card key={job.id} className="overflow-hidden hover-elevate transition-all border-slate-200">
                <CardContent className="p-0">
                  <div className="p-5 border-b space-y-3">
                    <div className="flex justify-between items-start">
                      <h3 className="text-xl font-bold text-red-600 tracking-tight">{job.jobNo}</h3>
                      <Badge variant="outline" className={`
                        ${job.status === "Pending" ? "bg-orange-50 text-orange-700 border-orange-200" : ""}
                        ${job.status === "In Progress" ? "bg-blue-50 text-blue-700 border-blue-200" : ""}
                        ${job.status === "Completed" ? "bg-green-50 text-green-700 border-green-200" : ""}
                        ${job.status === "Cancelled" ? "bg-slate-50 text-slate-700 border-slate-200" : ""}
                      `}>
                        {job.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(job.date), "MMM dd, yyyy")}
                    </div>
                    {job.vehicleType && (
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100/50 px-2 py-1 rounded w-fit">
                        <Car className="h-3 w-3" />
                        {job.vehicleType}
                      </div>
                    )}
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center border text-slate-400">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{job.customerName}</p>
                        <p className="text-xs text-muted-foreground">{job.phoneNumber}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center border text-slate-400">
                        <Car className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{job.year} {job.make} {job.model}</p>
                        <p className="text-xs text-muted-foreground">{job.licensePlate}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center border text-slate-400">
                        <Settings className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">
                          {(job.services[0]?.name || job.ppfs[0]?.name || job.accessories[0]?.name || "General Service").split(" - Tech:")[0]}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {job.services.length + job.ppfs.length + job.accessories.length > 1 
                            ? `+ ${job.services.length + job.ppfs.length + job.accessories.length - 1} more items`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-4 bg-slate-50/50 border-t flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimated Cost</p>
                      <p className="text-2xl font-black text-red-600 flex items-center">
                        <IndianRupee className="h-5 w-5 mr-0.5" />
                        {job.estimatedCost.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Technician</p>
                      <p className="text-sm font-bold text-slate-700">
                        {(() => {
                          if (job.technician) return job.technician;
                          if (job.services?.[0]?.technician) return job.services[0].technician;
                          
                          // Fallback: Parse from service name "Service Name - Tech: Technician Name"
                          const firstName = job.services?.[0]?.name || "";
                          const techMatch = firstName.match(/- Tech:\s*(.+)$/i);
                          if (techMatch) return techMatch[1].trim();
                          
                          return "Unassigned";
                        })()}
                      </p>
                    </div>
                  </div>

                  <div className="flex p-2 gap-2 border-t bg-slate-50/30">
                    <Button 
                      variant="outline" 
                      className="flex-1 h-10 font-bold uppercase tracking-widest text-[10px]"
                      onClick={() => setLocation(`/job-cards/${job.id}`)}
                    >
                      View Details
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="flex-1 h-10 font-bold uppercase tracking-widest text-[10px]"
                      onClick={() => {
                        const createdFromPos =
                          job.referralSource === "POS" ||
                          job.serviceNotes === "Created from POS";
                        setLocation(
                          createdFromPos
                            ? `/pos?edit=${job.id}`
                            : `/add-job?id=${job.id}`,
                        );
                      }}
                    >
                      Edit Job Card
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
