import { requireUser } from "@/lib/auth";
import { Heading, Panel, Field } from "@/components/common";
import { ActionForm, Submit } from "@/components/form";
import { recordDrivingLicense } from "@/app/actions";
import { money, DRIVING_PRICE_CENTS } from "@/lib/policy";
export default async function NewDrivingLicense() {
  await requireUser(["STATE_ASSISTANT", "STATE_EMPLOYEE", "ADMIN"]);
  return (
    <>
      <Heading
        title="Record driving license"
        description="Directly issue a driving license to the license registry. No expiry date; payment is recorded as received."
      />
      <Panel title="Citizen details">
        <ActionForm action={recordDrivingLicense}>
          <Field label="Citizen full name">
            <input name="citizenName" required minLength={2} maxLength={120} />
          </Field>
          <Field label="Citizen ID (CID)">
            <input name="cid" required maxLength={60} />
          </Field>
          <Field label="Phone number">
            <input name="phone" type="tel" required maxLength={30} />
          </Field>
          <div className="full">
            <Field label="Notes (optional)">
              <textarea name="notes" maxLength={5000} />
            </Field>
          </div>
          <div className="alert info full">
            Fee {money(DRIVING_PRICE_CENTS)} — payment status will be set to <strong>Received</strong>. Split: you (reviewer) 50%, government 50%, lawyer 0%.
            The license is issued immediately with no expiry date.
          </div>
          <div className="form-footer">
            <Submit>Record license</Submit>
          </div>
        </ActionForm>
      </Panel>
    </>
  );
}
