import { AlertCircle, LoaderCircle } from "lucide-react";
import { ApiError } from "../api/client";
import { label } from "../utils/format";
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      <span aria-hidden="true" className="dot" />
      {label(status)}
    </span>
  );
}
export function Loading({ text = "Loading workspace…" }: { text?: string }) {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" size={24} />
      <p>{text}</p>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="error">
      <AlertCircle size={18} />
      <div>
        <strong>
          {error instanceof ApiError
            ? error.message
            : "Unable to load data. Check your connection and retry."}
        </strong>
        {error instanceof ApiError && error.requestId && (
          <small>Reference: {error.requestId}</small>
        )}
        {retry && (
          <button className="text-button" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
