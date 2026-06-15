import { GlobalAssignmentPanel } from "./GlobalAssignmentPanel";

interface AdminGlobalAssignmentScreenProps {
  onUnauthorized: () => void;
}

export function AdminGlobalAssignmentScreen({ onUnauthorized }: AdminGlobalAssignmentScreenProps) {
  return (
    <section className="content single-column global-assignment-layout">
      <GlobalAssignmentPanel onUnauthorized={onUnauthorized} />
    </section>
  );
}
