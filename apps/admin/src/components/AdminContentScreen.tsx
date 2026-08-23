import { AssetLibrary } from "./AssetLibrary";
import type { AdminUser } from "../../../shared/adminContracts";

interface AdminContentScreenProps {
  currentUser: AdminUser;
  onUnauthorized: () => void;
}

export function AdminContentScreen({ currentUser, onUnauthorized }: AdminContentScreenProps) {
  return (
    <section className="content single-column content-workspace">
      <AssetLibrary currentUser={currentUser} onUnauthorized={onUnauthorized} />
    </section>
  );
}
