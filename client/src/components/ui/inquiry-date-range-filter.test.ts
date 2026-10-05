import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InquiryDateRangeFilter, rangeToFilterDates } from "./inquiry-date-range-filter";

test("selected calendar endpoints map to local date keys without UTC shifts", () => {
  assert.deepEqual(rangeToFilterDates({
    from: new Date(2026, 9, 1), to: new Date(2026, 9, 5),
  }), { from: "2026-10-01", to: "2026-10-05" });
});

test("one selected day applies as both endpoints and clearing removes both", () => {
  assert.deepEqual(rangeToFilterDates({ from: new Date(2026, 9, 5) }), {
    from: "2026-10-05", to: "2026-10-05",
  });
  assert.deepEqual(rangeToFilterDates(undefined), { from: "", to: "" });
});

test("the single date-range trigger displays both endpoints or its empty prompt", () => {
  const render = (from: string, to: string) => renderToStaticMarkup(React.createElement(
    InquiryDateRangeFilter, { from, to, onChange: () => {} },
  ));
  assert.match(render("", ""), /Select date range/);
  assert.match(render("2026-10-01", "2026-10-05"), /01 Oct 2026.*05 Oct 2026/);
});
