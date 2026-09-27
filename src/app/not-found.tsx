import Link from "next/link";
export default function NotFound() {
  return (
    <main className="main">
      <h1>Record not found</h1>
      <p style={{ margin: "20px 0" }}>
        This record doesn’t exist or isn’t available to your account.
      </p>
      <Link className="btn btn-primary" href="/dashboard">
        Return to dashboard
      </Link>
    </main>
  );
}
