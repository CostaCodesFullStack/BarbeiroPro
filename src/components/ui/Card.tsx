import type { HTMLAttributes } from "react";

export default function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={["card", "ui-card", className].filter(Boolean).join(" ")} />;
}
