import MfaSettings from "./MfaSettings";
import ApiKeysPage from "./ApiKeys";
import ScimTokensSection from "./ScimTokens";
import SmsProvidersSection from "./SmsProviders";

export default function SecurityPage() {
  return (
    <div style={{ maxWidth: "800px" }}>
      <h2
        style={{
          margin: "0 0 4px",
          fontSize: "18px",
          fontWeight: 600,
          color: "var(--io-text-primary)",
        }}
      >
        Security
      </h2>
      <p
        style={{
          margin: "0 0 32px",
          fontSize: "13px",
          color: "var(--io-text-secondary)",
        }}
      >
        Manage your account security settings, two-factor authentication, and
        API access keys.
      </p>

      {/* MFA section */}
      <section style={{ marginBottom: "40px" }}>
        <MfaSettings />
      </section>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid var(--io-border)",
          margin: "0 0 32px",
        }}
      />

      {/* API Keys section */}
      <section style={{ marginBottom: "40px" }}>
        <ApiKeysPage />
      </section>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid var(--io-border)",
          margin: "0 0 32px",
        }}
      />

      {/* SCIM Provisioning section */}
      <section style={{ marginBottom: "40px" }}>
        <ScimTokensSection />
      </section>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid var(--io-border)",
          margin: "0 0 32px",
        }}
      />

      {/* SMS Providers section */}
      <section>
        <SmsProvidersSection />
      </section>
    </div>
  );
}
