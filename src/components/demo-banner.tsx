import { FlaskConical } from "lucide-react";

export function DemoBanner() {
  return (
    <div className="demo-banner">
      <FlaskConical size={18} aria-hidden="true" />
      <div>
        <strong>Demonstration edition</strong>
        <span>
          Connect Supabase and OpenAI to replace these sample stories with verified daily publishing.
        </span>
      </div>
    </div>
  );
}
