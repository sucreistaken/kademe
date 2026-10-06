import { PanelHeader } from "./panel-header";

/** Page heading for the hiring and library screens (HIRING-UX 8.4): the shared PanelHeader (P2). */
export function PageTitle({ title, sub, action, eyebrow }: { title: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return <PanelHeader kicker={eyebrow} title={title} meta={sub} primary={action} />;
}
