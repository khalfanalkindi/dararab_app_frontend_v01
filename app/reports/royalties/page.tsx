import { redirect } from "next/navigation"

/** Legacy path — royalties moved out of Reports into its own mini-system. */
export default function LegacyRoyaltiesRedirect() {
  redirect("/royalties")
}
