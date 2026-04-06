import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SettingsTabs } from "../../shared/components/SettingsTabs";
import SettingsPageLayout from "./SettingsPageLayout";
import { ArchiveTab } from "./ArchiveSettings";
import { BackupTab } from "./BackupRestore";

type Tab = "archive" | "backup";

const TABS = [
  { id: "archive", label: "Archive" },
  { id: "backup", label: "Backup & Restore" },
];

export default function SystemSettings() {
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get("tab") as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(
    urlTab === "backup" ? "backup" : "archive",
  );

  return (
    <SettingsPageLayout
      title="System"
      description="Archive retention, backup management, and system maintenance"
    >
      <SettingsTabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as Tab)}
      />
      {activeTab === "archive" && <ArchiveTab />}
      {activeTab === "backup" && <BackupTab />}
    </SettingsPageLayout>
  );
}
