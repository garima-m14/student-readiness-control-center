import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "../src/auth/context";
import { Students } from "../src/pages/Students";
const idA = "11111111-1111-4111-8111-111111111111";
const idB = "22222222-2222-4222-8222-222222222222";
const user = (id: string) => ({
  id,
  tenantId: id,
  sessionId: id,
  name: id === idA ? "Acme User" : "Northstar User",
  email: "user@example.test",
  role: "ADMIN",
  tenantName: id === idA ? "Acme Training" : "Northstar Academy",
});
const list = (id: string) => ({
  items: [
    {
      id,
      tenantId: id,
      name: id === idA ? "Acme Secret Student" : "Northstar Student",
      email: "student@example.test",
      phone: null,
      version: 1,
      score: 0,
      status: "INCOMPLETE",
      createdAt: "2026-09-20T00:00:00Z",
      updatedAt: "2026-09-20T00:00:00Z",
    },
  ],
  total: 1,
  nextCursor: null,
  summary: { INCOMPLETE: 1 },
});
it("real auth provider clears previous account queries and never renders its delayed directory response", async () => {
  let resolveOld!: (value: Response) => void;
  const old = new Promise<Response>((resolve) => {
    resolveOld = resolve;
  });
  let loggedInB = false;
  const fetcher = vi.fn((path: string) => {
    if (path.endsWith("/auth/me"))
      return Promise.resolve(new Response(JSON.stringify(user(idA))));
    if (path.endsWith("/auth/login")) {
      loggedInB = true;
      return Promise.resolve(new Response(JSON.stringify(user(idB))));
    }
    if (path.includes("/students"))
      return loggedInB
        ? Promise.resolve(new Response(JSON.stringify(list(idB))))
        : old;
    throw new Error("Unexpected endpoint");
  });
  vi.stubGlobal("fetch", fetcher);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Workspace() {
    const auth = useAuth();
    return (
      <>
        <button
          onClick={() =>
            void auth.login({
              organization: "Northstar Academy",
              email: "admin@northstar.test",
              password: "local-test-password",
            })
          }
        >
          Switch tenant
        </button>
        {auth.user ? (
          <Students key={auth.user.sessionId} />
        ) : (
          <span>No tenant content</span>
        )}
      </>
    );
  }
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AuthProvider>
          <Workspace />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText("Loading students…");
  fireEvent.click(screen.getByText("Switch tenant"));
  await screen.findByText("Northstar Student");
  await act(async () => resolveOld(new Response(JSON.stringify(list(idA)))));
  expect(screen.queryByText("Acme Secret Student")).not.toBeInTheDocument();
  expect(screen.getByText("Northstar Student")).toBeInTheDocument();
  expect(
    client
      .getQueryCache()
      .getAll()
      .every((q) => q.queryKey[0] === idB),
  ).toBe(true);
});
