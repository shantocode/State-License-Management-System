import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { ActionForm, Submit } from "@/components/form";
import { Field } from "@/components/common";
import { login } from "../actions";
import { ThemeToggle } from "@/components/theme-toggle";
export default function Login() {
  return (
    <main className="login-page" id="main">
      <header className="login-masthead">
        <Image src="/state-logo.png" alt="City of Los Santos seal" width={60} height={60} priority />
        <div>
          <span className="eyebrow">City of Los Santos</span>
          <h2>State Licensing Management System</h2>
        </div>
        <span className="access-label">Authorized personnel</span>
        <ThemeToggle />
      </header>
      <section className="login-aside">
        <span className="eyebrow">Licensing & public administration</span>
        <h1>
          Serving the city.
          <br />
          <em>Upholding the standard.</em>
        </h1>
        <p>
          A single workspace for citizen licenses, application reviews, and
          transparent revenue management.
        </p>
        <ul className="service-list">
          <li><strong>Applications & renewals</strong><span>Submit citizen details and track each review.</span></li>
          <li><strong>License registry</strong><span>Manage issued licenses, validity, and history.</span></li>
          <li><strong>Revenue & accountability</strong><span>Review fee allocations and administrative records.</span></li>
        </ul>
        <footer>STATE LICENSING AUTHORITY · LOS SANTOS</footer>
      </section>
      <section className="login-content">
        <div className="login-card">
          <span className="eyebrow">Personnel access</span>
          <h2>Sign in to the licensing portal</h2>
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
              Sign in to portal <ArrowRight size={17} />
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
