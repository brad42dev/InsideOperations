import { useSearchParams } from "react-router-dom";
import { SettingsTabs } from "../../shared/components/SettingsTabs";
import SettingsPageLayout from "./SettingsPageLayout";
import { UsersTab } from "./Users";
import { RolesTab } from "./Roles";
import { GroupsTab } from "./Groups";
import { SessionsTab } from "./Sessions";

const TABS = [
  { id: "users", label: "Users" },
  { id: "roles", label: "Roles" },
  { id: "groups", label: "Groups" },
  { id: "sessions", label: "Sessions" },
];
const VALID_TABS = TABS.map((t) => t.id);

export default function IdentityAccess() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") ?? "";
  const activeTab = VALID_TABS.includes(tabParam) ? tabParam : "users";

  function handleTabChange(id: string) {
    setSearchParams({ tab: id }, { replace: true });
  }

  return (
    <SettingsPageLayout
      title="Identity & Access"
      description="Manage users, roles, groups, and active sessions"
    >
      <SettingsTabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      >
        {activeTab === "users" && <UsersTab />}
        {activeTab === "roles" && <RolesTab />}
        {activeTab === "groups" && <GroupsTab />}
        {activeTab === "sessions" && <SessionsTab />}
      </SettingsTabs>
    </SettingsPageLayout>
  );
}
