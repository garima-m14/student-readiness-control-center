import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Code2,
  Server,
  Database,
  BrainCircuit,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { useStudent } from "../hooks/students";
import { useAuth } from "../auth/context";
import { api } from "../api/client";
import { activitySchema } from "../schemas/api";
import { Badge, ErrorState, Loading } from "../components/ui";
import { AttemptForm } from "../components/AttemptForm";
import { EditStudent } from "../components/EditStudent";
import { date, initials, label } from "../utils/format";
const icons = {
  frontend: Code2,
  backend: Server,
  databases: Database,
  problem_solving: BrainCircuit,
};
export function StudentDetail() {
  const { id = "" } = useParams();
  const student = useStudent(id);
  const { user } = useAuth();
  const [cursor, setCursor] = useState<string | null>(null);
  const activity = useQuery({
    queryKey: [
      user?.tenantId,
      user?.id,
      user?.sessionId,
      "activity",
      id,
      cursor,
    ],
    queryFn: ({ signal }) =>
      api(
        `/students/${id}/activity?limit=10${cursor ? `&cursor=${cursor}` : ""}`,
        activitySchema,
        { signal },
      ),
    refetchInterval: 5000,
  });
  if (student.isPending) return <Loading />;
  if (student.isError)
    return (
      <ErrorState error={student.error} retry={() => void student.refetch()} />
    );
  const s = student.data;
  return (
    <>
      <Link className="back-link" to="/students">
        <ArrowLeft size={16} /> Back to students
      </Link>
      <div className="page-heading detail-heading">
        <div className="student-title">
          <span className="avatar large">{initials(s.name)}</span>
          <div>
            <span className="eyebrow">STUDENT PROFILE</span>
            <h1 tabIndex={-1}>{s.name}</h1>
            <p>
              {s.email}
              {s.phone ? ` · ${s.phone}` : ""}
            </p>
          </div>
        </div>
        <button
          className="secondary"
          disabled={student.isFetching}
          onClick={() => void student.refetch()}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
      <section className="readiness-banner">
        <div>
          <span className="eyebrow">OVERALL READINESS</span>
          <div className="overall-score">
            {s.score.toFixed(2)}
            <span>/ 100</span>
          </div>
          <Badge status={s.status} />
        </div>
        <div className="calculation">
          <h2>Four competencies. One complete picture.</h2>
          <p>
            Frontend × 30% + Backend × 30% + Databases × 25% + Problem solving ×
            15%
          </p>
          <p className="formula">
            {s.competencies
              .map((c) => `${c.score ?? 0} × ${c.weight}%`)
              .join(" + ")}{" "}
            = <strong>{s.score.toFixed(2)}</strong>
          </p>
          {s.missing.length > 0 ? (
            <p className="missing">
              Missing evidence: {s.missing.map(label).join(", ")}. The score is
              partial until all competencies are assessed.
            </p>
          ) : (
            <p>All required competencies have valid assessment evidence.</p>
          )}
        </div>
        <span className="version">Version {s.version}</span>
      </section>
      <div className="section-heading">
        <h2>Competency evidence</h2>
        <span>Latest valid assessment in each area</span>
      </div>
      <section className="competency-grid">
        {s.competencies.map((c) => {
          const Icon = icons[c.key];
          return (
            <article className="panel competency" key={c.key}>
              <div className="competency-top">
                <span className="competency-icon">
                  <Icon size={20} />
                </span>
                <span>{c.weight}% weight</span>
              </div>
              <h3>{label(c.key)}</h3>
              <div className="competency-score">
                {c.score ?? "—"}
                <span>/ 100</span>
              </div>
              <div className="score-track">
                <span style={{ width: `${c.score ?? 0}%` }} />
              </div>
              {c.latest ? (
                <div className="evidence">
                  <span>
                    <Clock3 size={13} />
                    {date(c.latest.attemptedAt)}
                  </span>
                  <small>Evaluated by {c.latest.evaluator.name}</small>
                  <small title={c.latest.id}>
                    Attempt {c.latest.id.slice(0, 8)}
                  </small>
                </div>
              ) : (
                <p className="no-evidence">No valid attempt</p>
              )}
            </article>
          );
        })}
      </section>
      <div className="detail-columns">
        <div>
          {user?.role !== "VIEWER" && (
            <>
              <AttemptForm studentId={s.id} />
              <EditStudent student={s} />
            </>
          )}
          {user?.role === "VIEWER" && (
            <section className="panel form-panel">
              <h2>Evidence review</h2>
              <p>
                Your viewer account can review readiness and activity. An
                evaluator or administrator can record assessments.
              </p>
            </section>
          )}
        </div>
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Assessment activity</h2>
              <p>Operational events from this student’s record.</p>
            </div>
            <Clock3 size={19} />
          </div>
          {activity.isPending ? (
            <Loading text="Loading activity…" />
          ) : activity.isError ? (
            <ErrorState
              error={activity.error}
              retry={() => void activity.refetch()}
            />
          ) : (
            <>
              {activity.data.pending > 0 && (
                <p role="status" className="help pending">
                  {activity.data.pending} event(s) pending delivery. This panel
                  updates automatically.
                </p>
              )}
              {!activity.data.items.length ? (
                <div className="state">
                  <Clock3 size={26} />
                  <h3>No activity yet</h3>
                  <p>New assessment events will appear here.</p>
                </div>
              ) : (
                <ol className="timeline">
                  {activity.data.items.map((a) => (
                    <li key={a.eventId}>
                      <span
                        className={`event-dot ${a.type === "attempt.rejected" ? "rejected" : ""}`}
                      />
                      <strong>
                        {a.type === "attempt.succeeded"
                          ? "Assessment recorded"
                          : "Assessment rejected"}
                      </strong>
                      <p>
                        {a.metadata.competency
                          ? `${label(String(a.metadata.competency))} · ${a.metadata.score}/100`
                          : label(
                              String(a.metadata.code ?? "Request rejected"),
                            )}
                      </p>
                      <small>{date(a.occurredAt)}</small>
                      <small className="event-ref">
                        Request {a.requestId.slice(0, 8)}
                      </small>
                    </li>
                  ))}
                </ol>
              )}
              <div className="activity-pagination">
                <button
                  className="text-button"
                  disabled={!cursor}
                  onClick={() => setCursor(null)}
                >
                  Latest page
                </button>
                <button
                  className="text-button"
                  disabled={!activity.data.nextCursor}
                  onClick={() => setCursor(activity.data.nextCursor)}
                >
                  Next events →
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
