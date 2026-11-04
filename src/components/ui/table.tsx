import * as React from "react";
import { cn } from "@/lib/utils";
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="table-scroll">
      <table className={cn("data-table", className)} {...props} />
    </div>
  );
}
export function TableHeader(props: React.ComponentProps<"thead">) {
  return <thead {...props} />;
}
export function TableBody(props: React.ComponentProps<"tbody">) {
  return <tbody {...props} />;
}
export function TableRow(props: React.ComponentProps<"tr">) {
  return <tr {...props} />;
}
export function TableHead(props: React.ComponentProps<"th">) {
  return <th {...props} />;
}
export function TableCell(props: React.ComponentProps<"td">) {
  return <td {...props} />;
}
