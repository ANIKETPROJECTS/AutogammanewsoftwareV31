import { Button } from "@/components/ui/button";
import { TICKETS_PER_PAGE } from "@shared/ticket-list";

export function TicketPagination({ page, total, onPageChange }: {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (!total) return null;
  const totalPages = Math.max(1, Math.ceil(total / TICKETS_PER_PAGE));
  return (
    <nav aria-label="Ticket pagination" className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p className="text-xs text-muted-foreground">
        Showing {(page - 1) * TICKETS_PER_PAGE + 1}–{Math.min(page * TICKETS_PER_PAGE, total)} of {total} tickets
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}>Previous</Button>
        <span className="text-xs whitespace-nowrap">Page {page} of {totalPages}</span>
        <Button type="button" variant="outline" size="sm" disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}>Next</Button>
      </div>
    </nav>
  );
}
