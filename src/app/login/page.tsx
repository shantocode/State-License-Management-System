import { Landmark, ShieldCheck, ArrowRight } from "lucide-react";
import { ActionForm, Submit } from "@/components/form";
import { Field } from "@/components/common";
import { login } from "../actions";
export default function Login() {
  return (
    <main className="login-page">
      <section className="login-aside">
        <div className="brand">
          <span className="brand-mark">
            <Landmark />
          </span>
          <span>
            SLMS<small>STATE LICENSING</small>
          </span>
        </div>
        <h1>
          Public service.
          <br />
          <em>Accountable by design.</em>
        </h1>
        <p>
          A single workspace for citizen licenses, application reviews, and
          transparent revenue management.
        </p>
        <footer>STATE LICENSING MANAGEMENT SYSTEM</footer>
      </section>
      <section className="login-content">
        <div className="login-card">
          <ShieldCheck size={31} color="#b79242" />
          <h2>Sign in to your workspace</h2>
          <p>Use the account provided by your administrator.</p>
          <ActionForm action={login}>
            <Field label="Username">
              <input
                name="username"
                autoComplete="username"
                required
                maxLength={60}
                placeholder="Enter your username"
              />
            </Field>
            <Field label="Password">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                placeholder="Enter your password"
              />
            </Field>
            <Submit>
              Sign in <ArrowRight size={17} />
            </Submit>
          </ActionForm>
          <div className="login-note">
            No public registration. Contact your administrator for
            <br />
            account access or a password reset.
          </div>
        </div>
      </section>
    </main>
  );
}
