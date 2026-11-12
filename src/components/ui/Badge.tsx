import type { HTMLAttributes } from "react";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger";
};

export default function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={["ui-badge", `ui-badge--${tone}`, className].filter(Boolean).join(" ")}
    />
  );
}
