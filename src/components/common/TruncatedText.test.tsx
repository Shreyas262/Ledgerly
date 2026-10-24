import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TruncatedText } from "./TruncatedText";

const fileName = "travel-receipt-for-the-client-visit-in-september.pdf";

function setOverflow(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(scrollWidth);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(clientWidth);
}

afterEach(() => vi.restoreAllMocks());

describe("TruncatedText", () => {
  it("shows the full text on hover when it is cut off", async () => {
    setOverflow(400, 120);
    render(<TruncatedText>{fileName}</TruncatedText>);

    await userEvent.hover(screen.getByText(fileName));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(fileName);
  });

  it("shows no tooltip when the text fits", async () => {
    setOverflow(120, 120);
    render(<TruncatedText>{fileName}</TruncatedText>);

    await userEvent.hover(screen.getByText(fileName));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("uses the given title when the content is not plain text", async () => {
    setOverflow(400, 120);
    render(<TruncatedText title="Travel · 3">Travel<span> · 3</span></TruncatedText>);

    await userEvent.hover(screen.getByText("Travel"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Travel · 3");
  });
});
