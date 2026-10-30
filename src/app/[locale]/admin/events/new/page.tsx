import { NewEventForm } from "@/components/admin/tools";

export default function NewEventPage() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ font: "500 32px/40px var(--font-display)", margin: 0 }}>New event</h1>
      <p className="zq-meta">Create the event, its claim and citations, and an approximate place. Everything is saved as a draft; a scholarly reviewer approves it before it can be published to the timeline, atlas, stories and graph.</p>
      <NewEventForm />
    </div>
  );
}
