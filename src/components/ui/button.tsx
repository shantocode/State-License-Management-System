import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const variants = cva("btn", {
  variants: {
    variant: {
      default: "btn-primary",
      outline: "btn-outline",
      destructive: "btn-danger",
      ghost: "btn-ghost",
    },
  },
  defaultVariants: { variant: "default" },
});
export function Button({
  asChild = false,
  className,
  variant,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof variants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(variants({ variant }), className)} {...props} />;
}
