import { requireUser } from "@/lib/auth";
import { ActionForm, Submit } from "@/components/form";
import { Field, Panel, Heading } from "@/components/common";
import { changePassword } from "../actions";
export default async function PasswordPage() {
  const user = await requireUser(undefined, true);
  return (
    <main className="main" style={{ maxWidth: 700 }}>
      <Heading
        title="Change your password"
        description={
          user.mustChangePassword
            ? "Set a personal password before entering your workspace."
            : "Changing your password signs out all other sessions."
        }
      />
      <Panel>
        <ActionForm action={changePassword}>
          <div className="full">
            <Field label="Current password">
              <input
                name="current"
                type="password"
                required
                autoComplete="current-password"
              />
            </Field>
          </div>
          <Field label="New password" hint="At least 8 characters.">
            <input
              name="password"
              type="password"
              minLength={8}
              maxLength={128}
              required
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password">
            <input
              name="confirm"
              type="password"
              minLength={8}
              maxLength={128}
              required
              autoComplete="new-password"
            />
          </Field>
          <div className="form-footer">
            <Submit>Update password</Submit>
          </div>
        </ActionForm>
      </Panel>
    </main>
  );
}
