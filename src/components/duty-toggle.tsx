"use client";
import { useFormStatus } from "react-dom";
import { toggleDuty } from "@/app/actions";
function Btn({ onDuty }: { onDuty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`duty-button ${onDuty ? "on" : "off"}`} disabled={pending}>
      {pending ? "Updating…" : onDuty ? "Go off duty" : "Go on duty"}
    </button>
  );
}
export function DutyToggle({ onDuty }: { onDuty: boolean }) {
  return (
    <form action={toggleDuty}>
      <Btn onDuty={onDuty} />
    </form>
  );
}
