import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "small";
};

export default function Button({
  variant = "secondary",
  size = "default",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const classes = [
    "ui-button",
    `ui-button--${variant}`,
    size === "small" ? "ui-button--small" : "",
    className,
  ].filter(Boolean).join(" ");

  return <button {...props} type={type} className={classes} />;
}
