"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="main">
      <h1>We couldn’t load this page</h1>
      <p style={{ margin: "20px 0" }}>
        Please try again. If this continues, ask your administrator to check the
        service connection.
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
