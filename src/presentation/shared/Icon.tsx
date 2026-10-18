import type { ReactNode } from "react";
export type IconName =
  | "sound"
  | "mute"
  | "settings"
  | "save"
  | "arrow"
  | "close"
  | "history"
  | "check";
export function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    sound: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </>
    ),
    mute: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6m0-6-5 6" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="9" cy="7" r="3" />
        <circle cx="15" cy="17" r="3" />
      </>
    ),
    save: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    history: (
      <>
        <path d="M3 10a9 9 0 1 1 1 7M3 4v6h6m3-3v5l3 2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
