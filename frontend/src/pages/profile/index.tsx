import { useSearchParams } from "react-router-dom";
import { SettingsTabs } from "../../shared/components/SettingsTabs";
import ProfileTab from "./ProfileTab";
import SecurityTab from "./SecurityTab";
import SessionsTab from "./SessionsTab";
import PreferencesTab from "./PreferencesTab";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "sessions", label: "Sessions" },
  { id: "preferences", label: "Preferences" },
];

const VALID_TABS = TABS.map((t) => t.id);

export default function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") ?? "";
  const activeTab = VALID_TABS.includes(tabParam) ? tabParam : "profile";

  function handleTabChange(id: string) {
    setSearchParams({ tab: id }, { replace: true });
  }

  return (
    <div style={{ maxWidth: "960px", padding: "24px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2
          style={{
            margin: "0 0 4px",
            fontSize: "18px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          My Profile
        </h2>
        <p
          style={{ margin: 0, fontSize: "13px", color: "var(--io-text-muted)" }}
        >
          Manage your personal settings and security
        </p>
      </div>

      <SettingsTabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      >
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "security" && <SecurityTab />}
        {activeTab === "sessions" && <SessionsTab />}
        {activeTab === "preferences" && <PreferencesTab />}
      </SettingsTabs>
    </div>
  );
}
