import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found shell">
      <span>404</span>
      <h1>This trail runs outta road.</h1>
      <p>The story or page you requested could not be found.</p>
      <Link href="/">Head back to the holler</Link>
    </main>
  );
}
