import type { ButtonHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={
        "inline-flex items-center justify-center rounded-md bg-amber px-3 py-2 text-sm font-medium text-ink disabled:opacity-50 " +
        (props.className ?? "")
      }
    />
  );
}
