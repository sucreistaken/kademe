import Link from "next/link";
import { Button, DisabledReason } from "@/components/ui/button";

/** The library list's filled "add" button; a role that cannot write sees it disabled with the reason. */
export function LibraryAddButton({ href, label, canWrite, noPermission }: { href: string; label: string; canWrite: boolean; noPermission: string }) {
  if (canWrite) {
    return (
      <Button asChild variant="primary">
        <Link href={href}>{label}</Link>
      </Button>
    );
  }
  return (
    <>
      <Button variant="primary" disabled disabledReason={noPermission}>
        {label}
      </Button>
      <DisabledReason>{noPermission}</DisabledReason>
    </>
  );
}
