"use client";
import { useState } from "react";
import { ActionForm, Submit } from "./form";
import { Field } from "./common";
import { submitApplication } from "@/app/actions";
import {
  money,
  distribute,
  durationLabel,
  durations,
  priceForDays,
} from "@/lib/policy";
export function ApplicationForm({
  types,
  split,
  renewal,
}: {
  types: {
    id: string;
    name: string;
    price90Cents: number;
    price180Cents: number;
    price365Cents: number;
  }[];
  split: { lawyerBps: number; reviewerBps: number; governmentBps: number };
  renewal?: {
    id: string;
    cid: string;
    citizenName: string;
    phone: string;
    licenseTypeId: string;
  };
}) {
  const [selected, setSelected] = useState<string[]>(
    renewal ? [renewal.licenseTypeId] : types[0] ? [types[0].id] : [],
  );
  const initialDays = renewal
    ? { [renewal.licenseTypeId]: durations[0] }
    : types[0]
      ? { [types[0].id]: durations[0] }
      : {};
  const [daysByType, setDaysByType] =
    useState<Record<string, number>>(initialDays);
  function setDays(id: string, value: number) {
    setDaysByType((prev) => ({ ...prev, [id]: value }));
  }
  const chosen = types.filter((t) => selected.includes(t.id));
  const totalCents = chosen.reduce(
    (sum, t) => sum + priceForDays(t, daysByType[t.id] ?? durations[0]),
    0,
  );
  const totalSplit = distribute(
    totalCents,
    split.lawyerBps,
    split.reviewerBps,
    split.governmentBps,
  );
  function toggle(id: string) {
    if (renewal) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setDaysByType((prev) =>
      prev[id] !== undefined ? prev : { ...prev, [id]: durations[0] },
    );
  }
  return (
    <ActionForm action={submitApplication}>
      {renewal && <input type="hidden" name="renewalOfId" value={renewal.id} />}
      <Field label="Citizen full name">
        <input
          name="citizenName"
          required
          minLength={2}
          maxLength={120}
          defaultValue={renewal?.citizenName}
        />
      </Field>
      <Field label="Citizen ID (CID)">
        <input
          name="cid"
          required
          maxLength={60}
          defaultValue={renewal?.cid}
          readOnly={!!renewal}
        />
      </Field>
      <Field label="Phone number">
        <input
          name="phone"
          type="tel"
          required
          maxLength={30}
          defaultValue={renewal?.phone}
        />
      </Field>
      <div className="full">
        <Field
          label="License type(s) & duration"
          hint={
            renewal
              ? "Renewals keep the license type of the original license."
              : "Select one or more license types, each with its own duration."
          }
        >
          <div className="checkbox-list">
            {types
              .filter((t) => !renewal || t.id === renewal.licenseTypeId)
              .map((t) => {
                const isSelected = selected.includes(t.id);
                return (
                  <div key={t.id} className="license-type-row">
                    <label
                      className="checkbox"
                      style={renewal ? { opacity: 0.7 } : undefined}
                    >
                      <input
                        type="checkbox"
                        name="licenseTypeIds"
                        value={t.id}
                        checked={isSelected}
                        aria-disabled={!!renewal}
                        onChange={() => toggle(t.id)}
                      />
                      {t.name}
                      {!isSelected &&
                        ` — from ${money(priceForDays(t, durations[0]))}`}
                    </label>
                    {isSelected && (
                      <>
                        <select
                          name={`days_${t.id}`}
                          value={daysByType[t.id] ?? durations[0]}
                          onChange={(e) =>
                            setDays(t.id, Number(e.target.value))
                          }
                          aria-label={`Duration for ${t.name}`}
                          required
                        >
                          {durations.map((d) => (
                            <option key={d} value={d}>
                              {durationLabel(d)}
                            </option>
                          ))}
                        </select>
                        <span className="license-type-price">
                          {money(
                            priceForDays(t, daysByType[t.id] ?? durations[0]),
                          )}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            {!types.length && <p>No license types available.</p>}
          </div>
        </Field>
      </div>
      <div className="full">
        <Field
          label="Citizen ID picture link"
          hint="Paste a link to the citizen's ID photo (no file upload)."
        >
          <input
            name="citizenIdUrl"
            type="url"
            required
            maxLength={500}
            placeholder="https://…"
          />
        </Field>
      </div>
      <div className="full">
        <Field label="Notes (optional)">
          <textarea
            name="notes"
            maxLength={5000}
            placeholder="Additional information for the reviewer"
          />
        </Field>
      </div>
      {chosen.length > 0 && (
        <div className="full">
          <Field
            label="Revenue split preview"
            hint="Shown before you submit, based on current settings. Recorded only after approval."
          >
            <div className="alert info full" style={{ display: "block" }}>
              <div>
                Total license price for {chosen.length} type
                {chosen.length > 1 ? "s" : ""}:{" "}
                <strong>{money(totalCents)}</strong>
              </div>
              <div>You (lawyer) receive: {money(totalSplit.lawyerCents)}</div>
              <div>Reviewer receives: {money(totalSplit.reviewerCents)}</div>
              <div>Government receives: {money(totalSplit.governmentCents)}</div>
            </div>
          </Field>
        </div>
      )}
      <div className="alert info full">
        The reviewer will verify the citizen ID and decide the application.
        Earnings are recorded after approval. Selecting several license types
        submits one application per type.
      </div>
      <div className="form-footer">
        <Submit>{renewal ? "Submit renewal" : "Submit application"}</Submit>
      </div>
    </ActionForm>
  );
}
