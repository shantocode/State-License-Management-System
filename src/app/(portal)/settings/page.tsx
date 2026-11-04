import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Heading, Panel, Field } from "@/components/common";
import { ActionForm, Submit } from "@/components/form";
import { saveSettings } from "@/app/actions";
export default async function Settings() {
  await requireUser(["ADMIN"]);
  const s = await db.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
  return (
    <>
      <Heading
        title="System settings"
        description="Manage your authority name and future revenue allocations."
      />
      <Panel title="Organization & revenue split">
        <ActionForm action={saveSettings}>
          <div className="full">
            <Field label="Organization name">
              <input
                name="organization"
                defaultValue={s.organization}
                maxLength={100}
                required
              />
            </Field>
          </div>
          {[
            ["lawyer", "Lawyer share (%)", s.lawyerBps],
            ["reviewer", "Reviewer share (%)", s.reviewerBps],
            ["government", "Government share (%)", s.governmentBps],
          ].map(([name, label, value]) => (
            <Field key={name} label={String(label)}>
              <input
                name={String(name)}
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={Number(value) / 100}
                required
              />
            </Field>
          ))}
          <div className="alert info full">
            Percentages must total exactly 100%. Changes apply to future
            approvals; previous allocations keep their original values.
          </div>
          <div className="form-footer">
            <Submit>Save settings</Submit>
          </div>
        </ActionForm>
      </Panel>
    </>
  );
}
