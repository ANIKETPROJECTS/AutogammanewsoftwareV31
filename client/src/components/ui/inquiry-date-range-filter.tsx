import * as React from "react";
import { format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function rangeToFilterDates(range: DateRange | undefined) {
  if (!range?.from) return { from: "", to: "" };
  return {
    from: format(range.from, "yyyy-MM-dd"),
    to: format(range.to ?? range.from, "yyyy-MM-dd"),
  };
}

export function InquiryDateRangeFilter({ from, to, onChange }: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>();
  const label = from
    ? `${format(parseISO(from), "dd MMM yyyy")} – ${format(parseISO(to || from), "dd MMM yyyy")}`
    : "Select date range";

  return (
    <Popover open={open} onOpenChange={nextOpen => {
      if (nextOpen) setDraft(from ? { from: parseISO(from), to: to ? parseISO(to) : undefined } : undefined);
      setOpen(nextOpen);
    }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" data-testid="button-kiosk-inquiry-date-range"
          className="w-full justify-start gap-2 px-3 text-left text-sm font-normal">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-[calc(100vw-24px)] p-0">
        <p className="px-3 pt-3 text-xs text-muted-foreground">
          Select a start date, then an end date. Apply to filter.
        </p>
        <Calendar mode="range" selected={draft} onSelect={setDraft}
          defaultMonth={draft?.from} numberOfMonths={1} initialFocus />
        <div className="flex items-center justify-between gap-3 border-t p-3">
          <Button type="button" variant="outline" size="sm" onClick={() => {
            onChange("", ""); setDraft(undefined); setOpen(false);
          }}>Clear dates</Button>
          <Button type="button" size="sm" disabled={!draft?.from} onClick={() => {
            const dates = rangeToFilterDates(draft);
            onChange(dates.from, dates.to);
            setOpen(false);
          }}>Apply range</Button>
        </div>
        <p className="px-3 pb-3 text-[11px] text-muted-foreground">For one day, select it and apply. Dates use India time.</p>
      </PopoverContent>
    </Popover>
  );
}
