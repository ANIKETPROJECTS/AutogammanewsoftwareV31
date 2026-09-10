import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
  hideTopbar?: boolean;
  fullScreen?: boolean;
}

export function Layout({ children, hideTopbar = false, fullScreen = false }: LayoutProps) {
  return (
    <div className={cn("min-h-screen", fullScreen ? "bg-white" : "bg-gray-50/50")}>
      <Sidebar />
      <div className={cn("lg:ml-20 min-h-screen flex flex-col", fullScreen && "h-screen overflow-hidden")}>
        {!hideTopbar && <Topbar />}
        <main
          className={cn(
            "flex-1 overflow-y-auto",
            fullScreen ? "overflow-hidden p-3 lg:p-4" : "p-6 lg:p-8",
          )}
        >
          <div className={cn("mx-auto", fullScreen ? "h-full max-w-none" : "max-w-7xl")}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
