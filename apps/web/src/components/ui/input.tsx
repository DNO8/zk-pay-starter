import type { InputHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-md border border-graphite bg-ink px-3 py-2 text-sm text-paper placeholder:text-graphite " +
        (props.className ?? "")
      }
    />
  );
}
