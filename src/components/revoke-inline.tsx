"use client";
import { useState } from "react";
import { updateLicense } from "@/app/actions";
import { ActionForm, Submit } from "@/components/form";
import { Button } from "@/components/ui/button";

export function RevokeInline({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button
        type="button"
        variant="destructive"
        onClick={() => setOpen(true)}
      >
        Revoke
      </Button>
    );
  return (
    <ActionForm action={updateLicense} className="flex flex-col gap-2">
      <input name="id" type="hidden" value={id} />
      <input name="operation" type="hidden" value="revoke" />
      <input
        name="reason"
        required
        minLength={3}
        maxLength={1000}
        placeholder="Reason for revocation"
        aria-label="Reason for revocation"
        autoFocus
      />
      <div className="flex gap-2">
        <Submit danger>Confirm revoke</Submit>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </ActionForm>
  );
}
