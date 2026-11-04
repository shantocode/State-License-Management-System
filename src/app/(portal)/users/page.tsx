import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { param, pageNumber, type SearchParams } from "@/lib/queries";
import { roles, roleLabel, date } from "@/lib/policy";
import { Heading, Panel, Field, Pagination } from "@/components/common";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ActionForm, Submit } from "@/components/form";
import { Button } from "@/components/ui/button";
import { saveUser, deleteUser } from "@/app/actions";
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser(["ADMIN"]);
  const p = await searchParams,
    q = param(p, "q"),
    edit = param(p, "edit"),
    page = pageNumber(p);
  const [users, selected] = await Promise.all([
    db.user.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? { OR: [{ name: { contains: q } }, { username: { contains: q } }] }
          : {}),
      },
      include: { role: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 20,
      take: 21,
    }),
    edit
      ? db.user.findUnique({
          where: { id: edit, deletedAt: null },
          include: { role: true },
        })
      : null,
  ]);
  return (
    <>
      <Heading
        title="User accounts"
        description="Create and manage access for your licensing team."
      />
      <Panel
        title={selected ? `Edit ${selected.name}` : "Create an account"}
        action={selected && <Link href="/users">Create new instead</Link>}
      >
        <ActionForm action={saveUser} key={selected?.id || "new"}>
          <input name="id" type="hidden" value={selected?.id || ""} />
          <Field label="Full name">
            <input
              name="name"
              defaultValue={selected?.name}
              required
              maxLength={120}
            />
          </Field>
          <Field label="Username">
            <input
              name="username"
              defaultValue={selected?.username}
              required
              pattern="[a-zA-Z0-9._-]{3,60}"
              maxLength={60}
            />
          </Field>
          <Field label="Role">
            <select name="role" defaultValue={selected?.role.code || "LAWYER"}>
              {roles.map((r) => (
                <option value={r} key={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={selected ? "Reset password (optional)" : "Initial password"}
            hint="At least 8 characters. The user must change it on next sign-in."
          >
            <input
              name="password"
              type="password"
              minLength={8}
              maxLength={128}
              required={!selected}
              autoComplete="new-password"
            />
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={selected?.enabled ?? true}
            />
            Account enabled
          </label>
          <div className="form-footer">
            <Submit>{selected ? "Save account" : "Create account"}</Submit>
          </div>
        </ActionForm>
      </Panel>
      <Panel title="Team directory">
        <form className="filter-bar">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search names or usernames…"
            aria-label="Search accounts"
          />
          <Button variant="outline">Search</Button>
        </form>
        <Table>
          <TableHeader>
            <TableRow>
              {["Name", "Role", "Status", "Created", ""].map((x, i) => (
                <TableHead key={i}>{x}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.slice(0, 20).map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <strong>{u.name}</strong>
                  <small>{u.username}</small>
                </TableCell>
                <TableCell>{roleLabel(u.role.code)}</TableCell>
                <TableCell>
                  <span className={`badge ${u.enabled ? "active" : "expired"}`}>
                    {u.enabled ? "Enabled" : "Disabled"}
                  </span>
                </TableCell>
                <TableCell>{date(u.createdAt)}</TableCell>
                <TableCell>
                  <Link className="text-link" href={`/users?edit=${u.id}`}>
                    Manage →
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination
          path="/users"
          page={page}
          hasMore={users.length > 20}
          params={{ q }}
        />
      </Panel>
      {selected && (
        <Panel title="Delete account">
          <ActionForm action={deleteUser}>
            <input name="id" type="hidden" value={selected.id} />
            <label className="checkbox full">
              <input type="checkbox" name="confirm" required />
              Delete {selected.name}’s account and revoke access. Historical
              applications, earnings, and audit records remain.
            </label>
            <div className="form-footer">
              <Submit danger>Delete account</Submit>
            </div>
          </ActionForm>
        </Panel>
      )}
    </>
  );
}
