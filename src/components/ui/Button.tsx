import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cx } from "@/lib/cx";
import { Icon, type IconName } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  icon?: IconName;
  loading?: boolean;
  children?: ReactNode;
}

const classes = (variant: ButtonVariant, size: "md" | "sm", extra?: string) =>
  cx("zq-btn", `zq-btn-${variant}`, size === "sm" && "zq-btn-sm", extra);

/** Actions. One primary per view; unbuilt features render disabled with a visible "Coming soon" note. */
export function Button({ variant = "secondary", size = "md", icon, loading, disabled, type = "button", className, children, ...rest }: ButtonProps) {
  const I = icon ? Icon[icon] : null;
  return (
    <button
      type={type}
      className={classes(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="zq-spin" aria-hidden="true" /> : I ? <I /> : null}
      {children}
    </button>
  );
}

/** A navigation link styled as a button, for top-level calls to action outside reading flows. */
export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: { href: string; variant?: ButtonVariant; size?: "md" | "sm"; icon?: IconName; className?: string; children: ReactNode } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  const I = icon ? Icon[icon] : null;
  return (
    <Link href={href} className={cx(classes(variant, size, className), "zq-btn-link")} {...rest}>
      {I ? <I /> : null}
      {children}
    </Link>
  );
}
