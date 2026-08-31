import { redirect } from "next/navigation"

/** Legacy path — royalties history moved to /royalties/history. */
export default function LegacyRoyaltiesHistoryRedirect() {
  redirect("/royalties/history")
}
