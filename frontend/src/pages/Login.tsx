import { useState, useRef, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { GraduationCap, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "../auth/context";
import { ErrorState } from "../components/ui";
import { ApiError } from "../api/client";
const schema = z.object({
  organization: z.string().trim().min(1, "Enter your organization"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});
export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<Error | null>(null);
  if (user) return <Navigate to="/students" replace />;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busyRef.current) return;
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      setError(
        new ApiError("VALIDATION_ERROR", parsed.error.issues[0].message),
      );
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await login(parsed.data);
      navigate("/students");
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Sign in failed"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand">
          <GraduationCap /> readiness.
        </div>
        <span className="eyebrow">FROM POTENTIAL TO PREPARED</span>
        <h1>
          Every student.
          <br />A clearer path
          <br />
          <em>forward.</em>
        </h1>
        <p>
          Bring competency evidence, assessment activity, and student readiness
          into one focused workspace.
        </p>
        <div className="story-check">
          <CheckCircle2 /> Real evidence. Meaningful progress.
        </div>
        <small>STUDENT READINESS CONTROL CENTER</small>
      </section>
      <section className="login-form">
        <div className="login-card">
          <span className="eyebrow">WELCOME BACK</span>
          <h2>Sign in to your workspace</h2>
          <p>Pick up where your students left off.</p>
          <form onSubmit={submit}>
            <label>
              Organization
              <input
                name="organization"
                autoComplete="organization"
                placeholder="Acme Training"
                required
                maxLength={100}
              />
            </label>
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@organization.com"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {error && <ErrorState error={error} />}
            <button className="primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="login-footnote">
            Your organization determines your workspace.
            <br />
            Contact your administrator if you need access.
          </p>
        </div>
      </section>
    </div>
  );
}
