import React, { useRef } from "react";

interface Tab {
  id: string;
  label: string;
}

interface SettingsTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children?: React.ReactNode;
}

export function SettingsTabs({
  tabs,
  activeTab,
  onTabChange,
  children,
}: SettingsTabsProps) {
  const tabListRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (next >= 0) {
      e.preventDefault();
      onTabChange(tabs[next].id);
      const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons?.[next]?.focus();
    }
  }

  return (
    <div>
      <div
        ref={tabListRef}
        role="tablist"
        style={{
          display: "flex",
          borderBottom: "1px solid var(--io-border)",
          marginBottom: "20px",
        }}
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              style={{
                padding: "10px 16px",
                fontSize: "13px",
                fontWeight: isActive ? 600 : 400,
                background: "transparent",
                border: "none",
                borderBottom: isActive
                  ? "2px solid var(--io-accent)"
                  : "2px solid transparent",
                color: isActive
                  ? "var(--io-accent)"
                  : "var(--io-text-secondary)",
                cursor: "pointer",
                marginBottom: "-1px",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {children}
      </div>
    </div>
  );
}
