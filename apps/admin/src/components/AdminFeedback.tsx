import { AlertCircle, CheckCircle2 } from "lucide-react";

interface AdminFeedbackProps {
  className?: string;
  error: string | null;
  notice: string | null;
}

interface StatusMessageProps {
  children: string;
  kind: "error" | "notice";
}

export function AdminFeedback({ className = "feedback-stack", error, notice }: AdminFeedbackProps) {
  if (!error && !notice) {
    return null;
  }

  return (
    <div className={className}>
      {error ? <StatusMessage kind="error">{error}</StatusMessage> : null}
      {notice ? <StatusMessage kind="notice">{notice}</StatusMessage> : null}
    </div>
  );
}

export function StatusMessage({ children, kind }: StatusMessageProps) {
  const Icon = kind === "error" ? AlertCircle : CheckCircle2;

  return (
    <p
      aria-live={kind === "error" ? "assertive" : "polite"}
      className={kind === "error" ? "form-error" : "form-notice"}
      role={kind === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" size={16} />
      <span>{children}</span>
    </p>
  );
}
