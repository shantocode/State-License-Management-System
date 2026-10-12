"use client";
import { useState } from "react";
import { updateLicense } from "@/app/actions";
import { ActionForm, Submit } from "@/components/form";
import { Button } from "@/components/ui/button";

export function RevokeInline({ id, operation = "revoke" }: { id: string; operation?: "revoke" | "remove" }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
        >
          {operation === "remove" ? "Remove from list" : "Revoke with reason"}
        </Button>
      </div>
    );
  return (
    <ActionForm action={updateLicense} className="flex flex-col gap-2">
      <input name="id" type="hidden" value={id} />
      <input name="operation" type="hidden" value={operation} />
      <input
        name="reason"
        required
        minLength={3}
        maxLength={1000}
        placeholder={`Reason for ${operation}`}
        aria-label={`Reason for ${operation}`}
        autoFocus
      />
      <div className="flex gap-2">
        <Submit danger>Confirm {operation}</Submit>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}
