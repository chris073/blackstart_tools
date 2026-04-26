import { redirect } from "next/navigation";

/** This app is tools-only; marketing lives in blackstart_web. */
export default function RootPage() {
  redirect("/tools");
}
