"use client";
import { ActionForm, Submit } from "./form";
import { reviewGroup } from "@/app/actions";
export function BulkReviewForm({
  groupId,
  pendingCount,
}: {
  groupId: string;
  pendingCount: number;
}) {
  return (
    <ActionForm action={reviewGroup} className="form-grid">
      <input name="groupId" value={groupId} type="hidden" />
      <input name="paymentStatus" value="RECEIVED" type="hidden" />
      <div
        className="full"
        style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
      >
        <input name="decision" value="approve" type="hidden" />
        <Submit>
          Approve all {pendingCount} pending item{pendingCount > 1 ? "s" : ""}
        </Submit>
      </div>
    </ActionForm>
  );
}
