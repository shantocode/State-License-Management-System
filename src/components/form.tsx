"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./ui/button";
import type { ActionResult } from "@/app/actions";
export function ActionForm({
  action,
  children,
  className = "form-grid",
}: {
  action: (state: ActionResult, form: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && (
        <p className="alert error full" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="alert success full" role="status">
          {state.success}
        </p>
      )}
    </form>
  );
}
export function Submit({
  children = "Save changes",
  danger = false,
}: {
  children?: React.ReactNode;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={danger ? "destructive" : "default"}
      disabled={pending}
    >
      {pending ? "Saving…" : children}
    </Button>
  );
}
