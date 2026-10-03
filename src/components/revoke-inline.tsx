"use client";
import { useState } from "react";
import { updateLicense } from "@/app/actions";
import { ActionForm, Submit } from "@/components/form";
import { Button } from "@/components/ui/button";

export function RevokeInline({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <div className="flex gap-2">
        <ActionForm action={updateLicense} className="inline">
          <input name="id" type="hidden" value={id} />
          <input name="operation" type="hidden" value="revoke" />
          <input
            name="reason"
            type="hidden"
            value="Expired license revoked from registry"
          />
          <Submit danger>Instant revoke</Submit>
        </ActionForm>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
        >
          Revoke with reason
        </Button>
      </div>
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
