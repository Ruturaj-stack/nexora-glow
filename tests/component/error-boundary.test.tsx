import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { PanelSkeleton, ListSkeleton } from "@/components/common/skeletons";

function Boom(): never {
  throw new Error("kaboom");
}

describe("ErrorBoundary", () => {
  it("renders children while healthy", () => {
    render(
      <ErrorBoundary scope="test">
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("degrades to a recoverable fallback on crash", () => {
    render(
      <ErrorBoundary scope="test">
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("This section stopped responding")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

describe("skeletons", () => {
  it("announces loading state to screen readers", () => {
    render(<PanelSkeleton label="Loading metrics" />);
    expect(screen.getByRole("status", { name: "Loading metrics" })).toBeInTheDocument();
  });

  it("renders the requested number of rows", () => {
    const { container } = render(<ListSkeleton rows={4} />);
    expect(container.firstElementChild?.children).toHaveLength(4);
  });
});
