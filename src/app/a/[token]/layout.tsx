import { ProctorProvider } from "@/components/candidate/proctor/ProctorProvider";

/**
 * Keeps one proctoring engine alive across the student pages. Soft navigation
 * between the check, the exam and the finish screen keeps the camera, the
 * screen share and fullscreen; only a hard reload drops them.
 */
export default async function StudentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div translate="no" className="notranslate">
      <ProctorProvider token={token}>{children}</ProctorProvider>
    </div>
  );
}
