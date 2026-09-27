"use client";
import { useState } from "react";
import { ActionForm, Submit } from "./form";
import { Field } from "./common";
import { review } from "@/app/actions";
export function ReviewForm({
  id,
  requestedDays,
}: {
  id: string;
  requestedDays: number;
}) {
  const [decision, setDecision] = useState("approve");
  return (
    <ActionForm action={review}>
      <input name="id" value={id} type="hidden" />
      <Field label="Decision">
        <select
          name="decision"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
        >
          <option value="approve">Approve application</option>
          <option value="reject">Reject application</option>
        </select>
      </Field>
      {decision === "approve" ? (
        <>
          <Field
            label="License duration"
            hint="Defaults to what the applicant requested."
          >
            <select name="days" defaultValue={String(requestedDays)}>
              <option value="90">3 months · 90 days</option>
              <option value="180">6 months · 180 days</option>
              <option value="365">12 months · 365 days</option>
            </select>
          </Field>
          <Field
            label="Payment status"
            hint="Verify the Citizen ID picture, then record whether payment was received."
          >
            <select name="paymentStatus" defaultValue="RECEIVED" required>
              <option value="RECEIVED">Received</option>
              <option value="NOT_RECEIVED">Not received</option>
              <option value="WAIVED">Waived</option>
            </select>
          </Field>
        </>
      ) : (
        <div className="full">
          <Field label="Reason for rejection">
            <textarea name="reason" minLength={3} maxLength={1000} required />
          </Field>
        </div>
      )}
      <div className="form-footer">
        <Submit danger={decision === "reject"}>
          {decision === "approve"
            ? "Approve & issue license"
            : "Reject application"}
        </Submit>
      </div>
    </ActionForm>
  );
}
