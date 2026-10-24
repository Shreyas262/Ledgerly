import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DateRangeFields, type DateRangeValue } from "./DateRangeFields";

function renderFields(value: DateRangeValue = { from: "", to: "" }, required = false) {
  const onChange = vi.fn();
  const view = render(<DateRangeFields value={value} onChange={onChange} required={required} />);
  return { onChange, view };
}

const from = () => screen.getByLabelText(/^From/);
const to = () => screen.getByLabelText(/^To/);

describe("DateRangeFields", () => {
  it("passes on each complete date", () => {
    const { onChange } = renderFields();

    fireEvent.change(from(), { target: { value: "2026-10-01" } });
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-10-01", to: "" });

    fireEvent.change(to(), { target: { value: "2026-10-24" } });
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-10-01", to: "2026-10-24" });
  });

  it("keeps a year that is still being typed to itself", () => {
    const { onChange } = renderFields({ from: "", to: "2026-10-24" });

    // A native date input reports 0002, then 0020, while "2026" is typed.
    fireEvent.change(from(), { target: { value: "0002-10-01" } });
    fireEvent.change(from(), { target: { value: "0020-10-01" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(from()).toHaveValue("0020-10-01");

    fireEvent.change(from(), { target: { value: "2026-10-01" } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: "2026-10-01", to: "2026-10-24" });
  });

  it("explains an end date before the start date and keeps both fields editable", () => {
    const { onChange } = renderFields({ from: "2026-10-10", to: "2026-10-20" });

    fireEvent.change(to(), { target: { value: "2026-10-05" } });

    expect(onChange).not.toHaveBeenCalled();
    expect(to()).toHaveAccessibleDescription("The end date must be on or after the start date.");
    expect(from()).toHaveAccessibleDescription("The end date must be on or after the start date.");
    expect(from()).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(from(), { target: { value: "2026-10-01" } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: "2026-10-01", to: "2026-10-05" });
    expect(to()).not.toHaveAttribute("aria-invalid", "true");
  });

  it("asks for both dates when they are required", () => {
    const { onChange } = renderFields({ from: "2026-10-01", to: "2026-10-24" }, true);

    fireEvent.change(to(), { target: { value: "" } });
    fireEvent.blur(to());

    expect(onChange).not.toHaveBeenCalled();
    expect(to()).toHaveAccessibleDescription("Enter a date.");
  });

  it("shows a range the page sets, such as after a reset", () => {
    const { view } = renderFields({ from: "2026-10-10", to: "2026-10-20" });
    fireEvent.change(to(), { target: { value: "2026-10-05" } });

    view.rerender(<DateRangeFields value={{ from: "", to: "" }} onChange={vi.fn()} />);

    expect(from()).toHaveValue("");
    expect(to()).toHaveValue("");
    expect(to()).not.toHaveAttribute("aria-invalid", "true");
  });

  it("limits each calendar to dates that keep the range in order", () => {
    renderFields({ from: "2026-10-10", to: "2026-10-20" });

    expect(from()).toHaveAttribute("max", "2026-10-20");
    expect(to()).toHaveAttribute("min", "2026-10-10");
  });
});
