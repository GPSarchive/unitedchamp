"use client";

import { btnPrimary, btnGhost, btnDanger } from "./tokens";

type Variant = "primary" | "ghost" | "danger";

const variantClass: Record<Variant, string> = {
  primary: btnPrimary,
  ghost: btnGhost,
  danger: btnDanger,
};

export default function Button({
  variant = "ghost",
  className = "",
  type = "button",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button type={type} className={`${variantClass[variant]} ${className}`} {...rest} />
  );
}
