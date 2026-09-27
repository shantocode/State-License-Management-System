import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { money, durationLabel, durations } from "@/lib/policy";
import { Heading, Panel, Field, Empty } from "@/components/common";
import { ActionForm, Submit } from "@/components/form";
import { saveType, deleteType } from "@/app/actions";
export default async function LicenseTypes({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireUser(["ADMIN"]);
  const { edit } = await searchParams,
    types = await db.licenseType.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
    selected = types.find((t) => t.id === edit);
  return (
    <>
      <Heading
        title="License catalog"
        description="Set license prices and control which types are available to lawyers."
      />
      <div className="equal-columns">
        {types.map((t) => (
          <Panel
            key={t.id}
            title={t.name}
            action={<Link href={`/license-types?edit=${t.id}`}>Edit →</Link>}
          >
            <div className="panel-body">
              <div className="catalog-price">
                {durations
                  .map((d) => `${durationLabel(d)}: ${money(
                    { 90: t.price90Cents, 180: t.price180Cents, 365: t.price365Cents }[d],
                  )}`)
                  .join(" · ")}
              </div>
              <p className="catalog-description">{t.description}</p>
              <span className={`badge ${t.enabled ? "active" : "expired"}`}>
                {t.enabled ? "Available" : "Disabled"}
              </span>
            </div>
          </Panel>
        ))}
      </div>
      {!types.length && <Empty title="No license types" />}
      <Panel
        title={selected ? "Edit license type" : "Add license type"}
        action={selected && <Link href="/license-types">Add new instead</Link>}
      >
        <ActionForm action={saveType} key={selected?.id || "new"}>
          <input name="id" type="hidden" value={selected?.id || ""} />
          <Field label="License name">
            <input
              name="name"
              defaultValue={selected?.name}
              required
              maxLength={100}
            />
          </Field>
          <Field label={`Price for ${durationLabel(90)} ($)`}>
            <input
              name="price90"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={selected ? selected.price90Cents / 100 : undefined}
              required
            />
          </Field>
          <Field label={`Price for ${durationLabel(180)} ($)`}>
            <input
              name="price180"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={
                selected ? selected.price180Cents / 100 : undefined
              }
              required
            />
          </Field>
          <Field label={`Price for ${durationLabel(365)} ($)`}>
            <input
              name="price365"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={
                selected ? selected.price365Cents / 100 : undefined
              }
              required
            />
          </Field>
          <div className="full">
            <Field label="Description">
              <textarea
                name="description"
                defaultValue={selected?.description}
                maxLength={500}
                required
              />
            </Field>
          </div>
          <label className="checkbox">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={selected?.enabled ?? true}
            />
            Available for applications
          </label>
          <div className="form-footer">
            <Submit />
          </div>
        </ActionForm>
      </Panel>
      {selected && (
        <Panel title="Delete license type">
          <ActionForm action={deleteType}>
            <input name="id" type="hidden" value={selected.id} />
            <label className="checkbox full">
              <input name="confirm" type="checkbox" required />
              Remove this type from the catalog. Existing applications and
              license history will be retained.
            </label>
            <div className="form-footer">
              <Submit danger>Delete license type</Submit>
            </div>
          </ActionForm>
        </Panel>
      )}
    </>
  );
}
