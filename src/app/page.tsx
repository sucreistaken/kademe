import { redirect } from "next/navigation";

/**
 * The root is not a screen. Managers land on today's work; anyone without a
 * session is bounced to the login by the manager layout.
 */
export default function Home() {
  redirect("/dashboard");
}
