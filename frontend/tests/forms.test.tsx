import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AttemptForm } from "../src/components/AttemptForm";
import { ErrorState, Loading } from "../src/components/ui";
import { EditStudent } from "../src/components/EditStudent";
import { ApiError } from "../src/api/client";
import type { Student } from "../src/types";
const id = "11111111-1111-4111-8111-111111111111";
const student: Student = {
  id,
  tenantId: id,
  name: "Student",
  email: "s@example.test",
  phone: null,
  version: 1,
  score: 0,
  status: "INCOMPLETE",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  competencies: [],
  missing: ["frontend", "backend", "databases", "problem_solving"],
};
function wrap(element: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  return {
    ...render(
      <QueryClientProvider client={client}>{element}</QueryClientProvider>,
    ),
    invalidate,
  };
}
it("blocks duplicate form submissions while saving", async () => {
  let resolve!: (r: Response) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((r) => {
        resolve = r;
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  wrap(<AttemptForm studentId={id} />);
  fireEvent.change(screen.getByLabelText(/Score/), { target: { value: "85" } });
  fireEvent.click(screen.getByRole("button", { name: "Save assessment" }));
  fireEvent.submit(
    screen.getByRole("button", { name: "Saving assessment…" }).closest("form")!,
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("button", { name: "Saving assessment…" }),
  ).toBeDisabled();
  resolve(new Response(JSON.stringify({ attemptId: id, student })));
  await screen.findByText("Assessment saved. Readiness is up to date.");
});
it("retains the idempotency key after network failure", async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Network failed"))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ attemptId: id, student })),
    );
  vi.stubGlobal("fetch", fetcher);
  wrap(<AttemptForm studentId={id} />);
  fireEvent.change(screen.getByLabelText(/Score/), { target: { value: "85" } });
  fireEvent.click(screen.getByRole("button", { name: "Save assessment" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Save assessment" }));
  await screen.findByText("Assessment saved. Readiness is up to date.");
  expect(fetcher.mock.calls[0][1].headers["Idempotency-Key"]).toBe(
    fetcher.mock.calls[1][1].headers["Idempotency-Key"],
  );
});
it("refreshes student evidence and shows stale-update conflict", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "CONFLICT",
            message: "This student changed. Refresh and try again.",
            requestId: id,
            fields: {},
          }),
          { status: 409 },
        ),
      ),
  );
  const { invalidate } = wrap(<EditStudent student={student} />);
  fireEvent.click(screen.getByText(/Edit student information/));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByRole("alert");
  expect(
    screen.getByText("This student changed. Refresh and try again."),
  ).toBeInTheDocument();
  await waitFor(() => expect(invalidate).toHaveBeenCalled());
});
it("announces loading and safe errors", () => {
  render(
    <>
      <Loading />
      <ErrorState
        error={
          new ApiError(
            "INTERNAL_ERROR",
            "Unable to complete the request",
            "reference",
          )
        }
      />
    </>,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to complete");
});
