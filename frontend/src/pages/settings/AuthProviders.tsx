import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  authProvidersApi,
  AuthProviderConfig,
  IdpRoleMapping,
  CreateProviderBody,
} from "../../api/authProviders";
import { rolesApi, Role } from "../../api/roles";
import { api } from "../../api/client";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  btnSmall,
  cellStyle,
} from "./settingsStyles";

// ---------------------------------------------------------------------------
// Guide content types & data
// ---------------------------------------------------------------------------

interface GuideCtx {
  redirectUri: string;
  entityId: string;
  acsUrl: string;
  metadataUrl: string;
}

interface GuideStep {
  title: string;
  nav?: string;
  body: string;
  code?: string | ((ctx: GuideCtx) => string);
  note?: string;
  warning?: string;
}

interface IdpGuide {
  id: string;
  label: string;
  steps: GuideStep[];
}

const OIDC_GUIDES: IdpGuide[] = [
  {
    id: "azure",
    label: "Microsoft Entra ID",
    steps: [
      {
        title: "Register the application",
        nav: "portal.azure.com → Microsoft Entra ID → App registrations → New registration",
        body: 'Name the app (e.g. "Inside Operations"), set Supported account types to "Accounts in this organizational directory only (Single tenant)".',
      },
      {
        title: "Set the redirect URI",
        nav: "App registration → Authentication → Add a platform → Web",
        body: "Add the following redirect URI, then click Configure:",
        code: (ctx) => ctx.redirectUri,
      },
      {
        title: "Copy the Client ID",
        nav: "App registration → Overview",
        body: "Copy the Application (client) ID — this is your Client ID. Also note the Directory (tenant) ID for the Issuer URL below.",
      },
      {
        title: "Create a client secret",
        nav: "App registration → Certificates & secrets → New client secret",
        body: 'Add a description (e.g. "I/O"), set expiry to 24 months, click Add. Copy the Value immediately — it won\'t be shown again.',
        warning: "Copy the secret Value now. Azure will not show it again.",
      },
      {
        title: "Set the Issuer URL",
        body: "Enter the Issuer URL using your tenant ID:",
        code: "https://login.microsoftonline.com/{tenant-id}/v2.0",
        note: "Replace {tenant-id} with your Directory (tenant) ID from the Overview page.",
      },
      {
        title: "Configure group claims (for role mapping)",
        nav: "App registration → Token configuration → Add groups claim",
        body: 'Select "Security groups", expand "ID token", check "Group ID". Azure sends Object IDs by default — use these as the IdP Group value in Role Mappings.',
        note: "Groups claim is named 'groups' in the token and contains an array of Object ID GUIDs.",
      },
      {
        title: "Assign users",
        nav: "Enterprise Applications → (your app) → Users and groups → Add user/group",
        body: "Assign the users or groups that should be allowed to sign in to Inside Operations.",
      },
    ],
  },
  {
    id: "google",
    label: "Google Workspace",
    steps: [
      {
        title: "Create an OAuth client",
        nav: "console.cloud.google.com → APIs & Services → OAuth consent screen",
        body: 'Set User Type to "Internal" (for your Workspace domain only). Fill in App name and contact details. Add scopes: userinfo.email, userinfo.profile, openid.',
      },
      {
        title: "Create credentials",
        nav: "APIs & Services → Credentials → Create Credentials → OAuth client ID",
        body: 'Application type: "Web application". Add the following Authorized redirect URI:',
        code: (ctx) => ctx.redirectUri,
      },
      {
        title: "Copy Client ID and Secret",
        body: "After clicking Create, copy the Client ID and Client Secret from the dialog.",
      },
      {
        title: "Set the Issuer URL",
        body: "Google's issuer URL is fixed:",
        code: "https://accounts.google.com",
      },
      {
        title: "Domain restriction (recommended)",
        body: 'To restrict login to your domain, add {"hd": "yourdomain.com"} in the Additional Params field below.',
        note: "Google OIDC does not include group memberships in the token. Use SCIM provisioning for group-based role mapping.",
      },
    ],
  },
  {
    id: "okta",
    label: "Okta",
    steps: [
      {
        title: "Create an app integration",
        nav: "your-org.okta.com → Applications → Create App Integration",
        body: 'Sign-in method: "OIDC - OpenID Connect". Application type: "Web Application". Click Next.',
      },
      {
        title: "Set the redirect URI",
        nav: "Configure SAML → Sign-in redirect URIs",
        body: "Paste the redirect URI below, then click Save:",
        code: (ctx) => ctx.redirectUri,
      },
      {
        title: "Copy Client ID and Secret",
        nav: "App integration page → General tab",
        body: "Copy the Client ID and Client secret from the Client Credentials section.",
      },
      {
        title: "Set the Issuer URL",
        body: "Use your Okta domain with the default auth server:",
        code: "https://{your-okta-domain}/oauth2/default",
        note: "Replace {your-okta-domain} with your org domain (e.g. corp.okta.com).",
      },
      {
        title: "Add a groups claim (for role mapping)",
        nav: "Security → API → Authorization Servers → default → Claims → Add Claim",
        body: 'Name: groups, Include in: "ID Token", Value type: Groups, Filter: Matches regex .*. Add groups to Scopes field below.',
        note: "Okta sends group display names (not IDs) — use these directly in Role Mappings.",
      },
      {
        title: "Assign users and groups",
        nav: "App integration → Assignments tab",
        body: "Assign the users or groups that should be allowed to sign in.",
      },
    ],
  },
  {
    id: "keycloak",
    label: "Keycloak",
    steps: [
      {
        title: "Create a client",
        nav: "your-keycloak/admin → (select realm) → Clients → Create client",
        body: 'Client type: OpenID Connect. Set a Client ID (e.g. "inside-operations"). Click Next.',
      },
      {
        title: "Enable client authentication",
        body: 'Set "Client authentication" to ON (makes it a confidential client). Standard flow: ON. Click Next.',
      },
      {
        title: "Set the redirect URI",
        body: "Add the following Valid redirect URI:",
        code: (ctx) => ctx.redirectUri,
      },
      {
        title: "Copy the client secret",
        nav: "Client → Credentials tab",
        body: "Copy the Client secret value.",
      },
      {
        title: "Set the Issuer URL",
        body: "Use your realm URL:",
        code: "https://{keycloak-host}/realms/{realm-name}",
        note: "Replace {keycloak-host} and {realm-name} with your values.",
      },
      {
        title: "Enable group claims (for role mapping)",
        nav: "Client → Client scopes → Add client scope → groups → Default",
        body: 'The built-in "groups" scope sends group paths like /GroupName. Use Prefix match type in Role Mappings for nested groups.',
        note: "Groups claim name is 'groups'. Add 'groups' to the Scopes field below.",
      },
    ],
  },
  {
    id: "other",
    label: "Other (Generic OIDC)",
    steps: [
      {
        title: "Register I/O as an OAuth 2.0 app",
        body: "In your IdP's admin console, create a new OAuth 2.0 / OIDC application (Web/Confidential type).",
      },
      {
        title: "Set the redirect URI",
        body: "Register the following redirect URI with your IdP:",
        code: (ctx) => ctx.redirectUri,
      },
      {
        title: "Obtain the Issuer URL",
        body: "Your IdP should provide an Issuer URL (also called Discovery URL base). It typically ends without a path or with /v2.0. The full discovery document is at {issuer}/.well-known/openid-configuration.",
      },
      {
        title: "Copy Client ID and Secret",
        body: "Obtain the Client ID (public) and Client Secret (keep private) from your IdP.",
      },
      {
        title: "Configure group claims (optional)",
        body: "If your IdP supports custom claims, add a claim named 'groups' containing an array of group names or IDs. Enter the claim name in the Groups Claim field below.",
      },
    ],
  },
];

const SAML_GUIDES: IdpGuide[] = [
  {
    id: "azure",
    label: "Microsoft Entra ID",
    steps: [
      {
        title: "Create an enterprise application",
        nav: "portal.azure.com → Microsoft Entra ID → Enterprise applications → New application",
        body: 'Click "Create your own application". Name it (e.g. "Inside Operations"). Select "Integrate any other application you don\'t find in the gallery". Click Create.',
      },
      {
        title: "Configure SAML",
        nav: "Enterprise application → Single sign-on → SAML",
        body: "Click Edit on Basic SAML Configuration. Enter:",
        note: "Use the Entity ID and ACS URL from the SP Information box above.",
      },
      {
        title: "Enter the Entity ID",
        body: "Paste this as the Identifier (Entity ID):",
        code: (ctx) => ctx.entityId,
      },
      {
        title: "Enter the ACS URL",
        body: "Paste this as the Reply URL (Assertion Consumer Service URL):",
        code: (ctx) => ctx.acsUrl,
      },
      {
        title: "Download federation metadata",
        nav: "SAML Certificates section → App Federation Metadata URL",
        body: "Copy the App Federation Metadata URL and paste it into the IdP Metadata URL field on the left, then click Fetch.",
        note: "Alternatively, download the Federation Metadata XML and paste its contents.",
      },
      {
        title: "Add a groups claim (for role mapping)",
        nav: "Attributes & Claims → Edit → Add a group claim",
        body: 'Select "Security groups". Under ID Token, check "Group ID". The groups attribute name in assertions will be:\nhttp://schemas.microsoft.com/ws/2008/06/identity/claims/groups',
        note: "Set the Groups Attribute Name below to: http://schemas.microsoft.com/ws/2008/06/identity/claims/groups",
      },
      {
        title: "Assign users and groups",
        nav: "Enterprise application → Users and groups → Add user/group",
        body: "Assign which users or groups can access Inside Operations.",
        warning:
          "Certificate expiry: Azure certificates expire every 3 years. Set a calendar reminder to renew.",
      },
    ],
  },
  {
    id: "google",
    label: "Google Workspace",
    steps: [
      {
        title: "Create a custom SAML app",
        nav: "admin.google.com → Apps → Web and mobile apps → Add App → Add custom SAML app",
        body: "Name the app and click Continue.",
      },
      {
        title: "Save IdP information",
        body: "On the Google IdP Information page, copy the SSO URL, Entity ID, and download the Certificate. You'll need these for the IdP Configuration fields on the left.",
        warning:
          "Save these values before clicking Continue — you can only download the certificate from this screen.",
      },
      {
        title: "Enter SP details",
        body: "On the Service Provider Details page, enter:",
        note: "ACS URL and Entity ID are shown in the SP Information box above.",
      },
      {
        title: "Enter the ACS URL",
        body: "Paste this as the ACS URL:",
        code: (ctx) => ctx.acsUrl,
      },
      {
        title: "Enter the Entity ID",
        body: "Paste this as the Entity ID:",
        code: (ctx) => ctx.entityId,
      },
      {
        title: "Configure Name ID",
        body: "Set Name ID format to EMAIL, Name ID to Basic Information → Primary Email.",
      },
      {
        title: "Map attributes",
        body: "Add attribute mappings:\n• Primary Email → email\n• First name → givenName\n• Last name → sn\nClick Finish.",
        note: "Google SAML does not include group memberships. Use SCIM for group-based role mapping.",
      },
      {
        title: "Enable the app",
        nav: "App settings → User access",
        body: 'Set the app to "ON for everyone" or for specific organizational units.',
      },
    ],
  },
  {
    id: "okta",
    label: "Okta",
    steps: [
      {
        title: "Create a SAML app",
        nav: "your-org.okta.com → Applications → Create App Integration",
        body: 'Sign-in method: "SAML 2.0". Click Next.',
      },
      {
        title: "Configure SAML",
        body: "On the Configure SAML tab, enter:",
      },
      {
        title: "Set the ACS URL",
        body: "Single sign on URL:",
        code: (ctx) => ctx.acsUrl,
      },
      {
        title: "Set the Entity ID",
        body: "Audience URI (SP Entity ID):",
        code: (ctx) => ctx.entityId,
      },
      {
        title: "Add attribute statements",
        body: "Under Attribute Statements, add:\n• email → user.email\n• firstName → user.firstName\n• lastName → user.lastName",
      },
      {
        title: "Add group attributes (for role mapping)",
        body: "Under Group Attribute Statements, add:\n• Name: groups, Filter: Matches regex .*\nThis sends all Okta group names in the assertion.",
      },
      {
        title: "Get IdP metadata",
        nav: "App → Sign On tab → Identity Provider metadata link",
        body: "Copy the Identity Provider Metadata URL and paste it into the IdP Metadata URL field on the left, then click Fetch.",
      },
      {
        title: "Assign users",
        nav: "App → Assignments tab",
        body: "Assign users or groups to the app.",
      },
    ],
  },
  {
    id: "other",
    label: "Other (Generic SAML 2.0)",
    steps: [
      {
        title: "Register I/O as a Service Provider",
        body: "In your IdP, create a new SAML 2.0 application or trust. You'll need to provide the SP metadata.",
      },
      {
        title: "Provide Entity ID",
        body: "Give your IdP this Entity ID:",
        code: (ctx) => ctx.entityId,
      },
      {
        title: "Provide ACS URL",
        body: "Give your IdP this Assertion Consumer Service URL:",
        code: (ctx) => ctx.acsUrl,
      },
      {
        title: "Or import SP metadata",
        body: "Many IdPs accept SP metadata XML directly. Your I/O metadata is available at:",
        code: (ctx) => ctx.metadataUrl,
      },
      {
        title: "Obtain IdP metadata",
        body: "Get your IdP's metadata URL (preferred) or XML. Paste the URL in the IdP Metadata URL field and click Fetch, or paste XML manually.",
      },
      {
        title: "Map attributes",
        body: "Configure your IdP to send email, display name, and (optionally) group membership as SAML attributes. Enter the attribute names in the Attribute Mapping section.",
      },
    ],
  },
];

const LDAP_GUIDES: IdpGuide[] = [
  {
    id: "ad",
    label: "Active Directory",
    steps: [
      {
        title: "Create a service account",
        nav: "Active Directory Users and Computers (ADUC) → OU=Service Accounts → New User",
        body: 'Create a dedicated read-only service account (e.g. io-svc). Set a strong password, check "Password never expires" and "User cannot change password". No special permissions needed.',
      },
      {
        title: "Find the Bind DN",
        nav: "ADUC → View → Advanced Features → Right-click account → Properties → Attribute Editor → distinguishedName",
        body: "Copy the distinguishedName attribute. This is your Bind DN.",
        code: "CN=io-svc,OU=Service Accounts,DC=corp,DC=plant,DC=com",
        note: "Replace with your actual account's DN.",
      },
      {
        title: "Set the Server URL",
        body: "Always use LDAPS (port 636) in production. Never use plain LDAP (389) in production environments.",
        code: "ldaps://dc01.corp.plant.com:636",
      },
      {
        title: "Configure the Search Base",
        body: "Set the search base to the OU containing your users (or root DC for all users):",
        code: "OU=Users,DC=corp,DC=plant,DC=com",
      },
      {
        title: "Set the User Filter",
        body: "This filter finds enabled user accounts by sAMAccountName (the standard AD login name):",
        code: "(&(sAMAccountName={username})(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))",
        note: "The userAccountControl clause excludes disabled accounts automatically.",
      },
      {
        title: "Configure group membership",
        body: "To find groups a user belongs to, set Group Filter to:",
        code: "(member:1.2.840.113556.1.4.1941:={userDN})",
        note: "This OID (LDAP_MATCHING_RULE_IN_CHAIN) resolves nested group membership recursively — a single LDAP query finds all transitive groups.",
      },
      {
        title: "Set attribute names",
        body: "Standard AD attribute names (use as defaults):\n• Username: sAMAccountName\n• Email: mail\n• Display Name: displayName\n• Group Name: cn",
      },
      {
        title: "Trust the CA certificate",
        nav: "Settings → Certificates → Add Trusted CA",
        body: "Upload your corporate CA certificate (not the server cert) so I/O can validate the LDAPS connection.",
      },
    ],
  },
  {
    id: "openldap",
    label: "OpenLDAP",
    steps: [
      {
        title: "Create a bind account",
        body: "Create a read-only service account with access to user and group entries. Note its full DN.",
      },
      {
        title: "Set the Server URL",
        body: "Use LDAPS or STARTTLS in production:",
        code: "ldaps://ldap.corp.plant.com:636",
      },
      {
        title: "Set the Search Base",
        body: "Set to the base DN containing your users:",
        code: "ou=people,dc=corp,dc=plant,dc=com",
      },
      {
        title: "Set the User Filter",
        body: "Standard OpenLDAP filter for inetOrgPerson users:",
        code: "(&(uid={username})(objectClass=inetOrgPerson))",
      },
      {
        title: "Set attribute names",
        body: "Standard OpenLDAP attribute names:\n• Username: uid\n• Email: mail\n• Display Name: cn or displayName",
      },
      {
        title: "Configure groups (posixGroup)",
        body: "For posixGroup schema, the group filter is:",
        code: "(&(memberUid={username})(objectClass=posixGroup))",
        note: "Use Group Name Attribute: cn",
      },
      {
        title: "Configure groups (groupOfNames)",
        body: "For groupOfNames schema, the group filter is:",
        code: "(&(member={userDN})(objectClass=groupOfNames))",
      },
    ],
  },
  {
    id: "other",
    label: "Other LDAP",
    steps: [
      {
        title: "Gather connection details",
        body: "You'll need: server hostname/IP, LDAP port (389 plain, 636 LDAPS), Bind DN and password for a service account, and Base DN for user search.",
      },
      {
        title: "Choose TLS mode",
        body: "Use LDAPS (port 636, TLS from the start) or StartTLS (port 389, upgrades to TLS). Plain LDAP is not recommended for production.",
      },
      {
        title: "Determine username attribute",
        body: "Find the attribute your directory uses for login names (e.g. uid, sAMAccountName, userPrincipalName). Set this as the Username Attribute below.",
      },
      {
        title: "Build the user filter",
        body: "Your user filter should match exactly one user per login attempt. Use {username} as a placeholder for the submitted username:\n(&(uid={username})(objectClass=inetOrgPerson))",
      },
      {
        title: "Configure group search (optional)",
        body: "To enable group-based role mapping, provide a Group Search Base and Group Filter that returns all groups a user belongs to.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    oidc: "var(--io-accent)",
    saml: "var(--io-info, #3b82f6)",
    ldap: "var(--io-warning)",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        background: "var(--io-surface-sunken)",
        color: colors[type] ?? "var(--io-text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        border: `1px solid ${colors[type] ?? "var(--io-border)"}`,
      }}
    >
      {type}
    </span>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: "11px",
        fontWeight: 700,
        color: "var(--io-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: "10px",
        marginTop: "4px",
        paddingBottom: "6px",
        borderBottom: "1px solid var(--io-border)",
      }}
    >
      {title}
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "4px 0 0",
        fontSize: "11px",
        color: "var(--io-text-muted)",
        lineHeight: 1.4,
      }}
    >
      {children}
    </p>
  );
}

interface CopyFieldProps {
  label: string;
  value: string;
  hint?: string;
}

function CopyField({ label, value, hint }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <input
          readOnly
          value={value}
          style={{
            ...inputStyle,
            fontFamily: "var(--io-font-mono, monospace)",
            fontSize: "12px",
            color: "var(--io-text-secondary)",
            cursor: "text",
          }}
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          onClick={handleCopy}
          style={{ ...btnSmall, whiteSpace: "nowrap" }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {hint && <FieldHint>{hint}</FieldHint>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup Guide panel
// ---------------------------------------------------------------------------

interface SetupGuideProps {
  type: "oidc" | "saml" | "ldap";
  ctx: GuideCtx;
}

function SetupGuide({ type, ctx }: SetupGuideProps) {
  const guides =
    type === "oidc" ? OIDC_GUIDES : type === "saml" ? SAML_GUIDES : LDAP_GUIDES;

  const [selectedId, setSelectedId] = useState(guides[0].id);
  const [collapsed, setCollapsed] = useState(false);

  // Reset selection when type changes
  const firstGuideId = guides[0].id;
  useEffect(() => {
    setSelectedId(firstGuideId);
  }, [firstGuideId]);

  const guide = guides.find((g) => g.id === selectedId) ?? guides[0];

  function resolveCode(code: string | ((ctx: GuideCtx) => string) | undefined) {
    if (!code) return null;
    return typeof code === "function" ? code(ctx) : code;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderLeft: "1px solid var(--io-border)",
      }}
    >
      {/* Guide header */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid var(--io-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "15px" }}>📋</span>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Setup Guide
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          style={{
            background: "none",
            border: "none",
            color: "var(--io-text-muted)",
            cursor: "pointer",
            fontSize: "14px",
            padding: "2px 4px",
            lineHeight: 1,
          }}
          title={collapsed ? "Expand guide" : "Collapse guide"}
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* IdP selector */}
          <div
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid var(--io-border)",
              flexShrink: 0,
            }}
          >
            <label
              style={{
                ...labelStyle,
                marginBottom: "4px",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              I'm using:
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{
                ...inputStyle,
                fontSize: "12px",
                padding: "5px 8px",
              }}
            >
              {guides.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          {/* Steps */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 16px 20px",
            }}
          >
            {guide.steps.map((step, i) => {
              const code = resolveCode(step.code);
              return (
                <div
                  key={i}
                  style={{
                    marginBottom: "16px",
                    paddingLeft: "28px",
                    position: "relative",
                  }}
                >
                  {/* Step number */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "2px",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      background: "var(--io-accent)",
                      color: "var(--io-text-on-accent, #fff)",
                      fontSize: "11px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>

                  {/* Step title */}
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--io-text-primary)",
                      marginBottom: "3px",
                      lineHeight: 1.3,
                    }}
                  >
                    {step.title}
                  </div>

                  {/* Nav path */}
                  {step.nav && (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "var(--io-accent)",
                        fontFamily: "var(--io-font-mono, monospace)",
                        marginBottom: "4px",
                        lineHeight: 1.4,
                        wordBreak: "break-word",
                      }}
                    >
                      {step.nav}
                    </div>
                  )}

                  {/* Body text */}
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--io-text-secondary)",
                      lineHeight: 1.5,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {step.body}
                  </div>

                  {/* Code value */}
                  {code && (
                    <div
                      style={{
                        marginTop: "5px",
                        padding: "6px 9px",
                        borderRadius: "var(--io-radius)",
                        background: "var(--io-surface-sunken)",
                        border: "1px solid var(--io-border)",
                        fontFamily: "var(--io-font-mono, monospace)",
                        fontSize: "11px",
                        color: "var(--io-text-primary)",
                        wordBreak: "break-all",
                        lineHeight: 1.5,
                      }}
                    >
                      {code}
                    </div>
                  )}

                  {/* Note */}
                  {step.note && (
                    <div
                      style={{
                        marginTop: "5px",
                        padding: "5px 8px",
                        borderRadius: "var(--io-radius)",
                        background:
                          "color-mix(in srgb, var(--io-info, #3b82f6) 10%, transparent)",
                        borderLeft: "2px solid var(--io-info, #3b82f6)",
                        fontSize: "11px",
                        color: "var(--io-text-secondary)",
                        lineHeight: 1.4,
                      }}
                    >
                      {step.note}
                    </div>
                  )}

                  {/* Warning */}
                  {step.warning && (
                    <div
                      style={{
                        marginTop: "5px",
                        padding: "5px 8px",
                        borderRadius: "var(--io-radius)",
                        background:
                          "color-mix(in srgb, var(--io-warning) 12%, transparent)",
                        borderLeft: "2px solid var(--io-warning)",
                        fontSize: "11px",
                        color: "var(--io-text-secondary)",
                        lineHeight: 1.4,
                      }}
                    >
                      ⚠ {step.warning}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role mappings panel
// ---------------------------------------------------------------------------

function RoleMappings({ provider }: { provider: AuthProviderConfig }) {
  const qc = useQueryClient();
  const [newGroup, setNewGroup] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [newMatchType, setNewMatchType] = useState("exact");

  const { data: mappingsResult, isLoading } = useQuery({
    queryKey: ["auth-provider-mappings", provider.id],
    queryFn: () => authProvidersApi.listMappings(provider.id),
  });

  const { data: rolesResult } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.list(),
  });

  const roles: Role[] = rolesResult?.success
    ? (rolesResult.data.data ?? [])
    : [];

  const createMutation = useMutation({
    mutationFn: (body: {
      idp_group: string;
      role_id: string;
      match_type: string;
    }) => authProvidersApi.createMapping(provider.id, body),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["auth-provider-mappings", provider.id],
      });
      setNewGroup("");
      setNewRoleId("");
      setNewMatchType("exact");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (mappingId: string) =>
      authProvidersApi.deleteMapping(provider.id, mappingId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["auth-provider-mappings", provider.id],
      });
    },
  });

  const mappings: IdpRoleMapping[] = mappingsResult?.success
    ? mappingsResult.data
    : [];

  function getRoleName(roleId: string): string {
    const role = roles.find((r) => r.id === roleId);
    return role?.display_name ?? roleId;
  }

  return (
    <div
      style={{
        background: "var(--io-surface-sunken)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        padding: "14px 16px",
        marginTop: "8px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          marginBottom: "12px",
        }}
      >
        Group → Role Mappings
      </div>

      {isLoading ? (
        <p style={{ fontSize: "13px", color: "var(--io-text-muted)" }}>
          Loading…
        </p>
      ) : mappings.length === 0 ? (
        <p
          style={{
            fontSize: "13px",
            color: "var(--io-text-muted)",
            marginBottom: "10px",
          }}
        >
          No mappings yet. Add a mapping below to assign roles based on IdP
          group membership.
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: "12px",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "1px solid var(--io-border)" }}>
              {["IdP Group / Value", "Role", "Match", ""].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "6px 10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--io-text-muted)",
                    textAlign: "left",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr
                key={m.id}
                style={{ borderBottom: "1px solid var(--io-border)" }}
              >
                <td
                  style={{
                    ...cellStyle,
                    fontFamily: "var(--io-font-mono, monospace)",
                    fontSize: "12px",
                  }}
                >
                  {m.idp_group}
                </td>
                <td style={cellStyle}>{getRoleName(m.role_id)}</td>
                <td style={{ ...cellStyle, fontSize: "12px" }}>
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: "999px",
                      background: "var(--io-surface-secondary)",
                      border: "1px solid var(--io-border)",
                      fontSize: "11px",
                    }}
                  >
                    {m.match_type}
                  </span>
                </td>
                <td style={{ ...cellStyle, textAlign: "right" }}>
                  <button
                    style={{
                      ...btnSmall,
                      color: "var(--io-danger)",
                      borderColor: "var(--io-danger)",
                    }}
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(m.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add mapping row */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 3, minWidth: "160px" }}>
          <label style={labelStyle}>IdP Group / Value</label>
          <input
            style={inputStyle}
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder="CN=Operators,DC=corp or group-name"
          />
        </div>
        <div style={{ flex: 2, minWidth: "120px" }}>
          <label style={labelStyle}>I/O Role</label>
          {roles.length > 0 ? (
            <select
              style={inputStyle}
              value={newRoleId}
              onChange={(e) => setNewRoleId(e.target.value)}
            >
              <option value="">— Select —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.display_name}
                </option>
              ))}
            </select>
          ) : (
            <input
              style={inputStyle}
              value={newRoleId}
              onChange={(e) => setNewRoleId(e.target.value)}
              placeholder="Role ID"
            />
          )}
        </div>
        <div style={{ flex: 1, minWidth: "90px" }}>
          <label style={labelStyle}>Match</label>
          <select
            style={inputStyle}
            value={newMatchType}
            onChange={(e) => setNewMatchType(e.target.value)}
          >
            <option value="exact">Exact</option>
            <option value="contains">Contains</option>
            <option value="prefix">Prefix</option>
            <option value="regex">Regex</option>
          </select>
        </div>
        <div>
          <button
            style={btnPrimary}
            disabled={
              createMutation.isPending || !newGroup.trim() || !newRoleId.trim()
            }
            onClick={() =>
              createMutation.mutate({
                idp_group: newGroup.trim(),
                role_id: newRoleId.trim(),
                match_type: newMatchType,
              })
            }
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider-specific form fields
// ---------------------------------------------------------------------------

interface OidcFieldsProps {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  claimsEmail: string;
  claimsName: string;
  claimsGroups: string;
  isEdit: boolean;
  onChange: (field: string, value: string) => void;
}

function OidcFields({
  issuerUrl,
  clientId,
  clientSecret,
  scopes,
  claimsEmail,
  claimsName,
  claimsGroups,
  isEdit,
  onChange,
}: OidcFieldsProps) {
  return (
    <>
      <SectionHeader title="Connection" />
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Issuer URL *</label>
        <input
          style={inputStyle}
          value={issuerUrl}
          onChange={(e) => onChange("issuerUrl", e.target.value)}
          placeholder="https://login.microsoftonline.com/{tenant-id}/v2.0"
          required
        />
        <FieldHint>
          The provider's base URL. Discovery document is fetched from{" "}
          <code style={{ fontFamily: "monospace" }}>
            {"{issuer}"}/.well-known/openid-configuration
          </code>
        </FieldHint>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "14px",
        }}
      >
        <div>
          <label style={labelStyle}>Client ID *</label>
          <input
            style={inputStyle}
            value={clientId}
            onChange={(e) => onChange("clientId", e.target.value)}
            placeholder="Application / Client ID"
            required
          />
        </div>
        <div>
          <label style={labelStyle}>Client Secret *</label>
          <input
            style={inputStyle}
            type="password"
            value={clientSecret}
            onChange={(e) => onChange("clientSecret", e.target.value)}
            placeholder={
              isEdit ? "Leave blank to keep current" : "Client secret value"
            }
          />
          {isEdit && (
            <FieldHint>Leave blank to keep the existing secret.</FieldHint>
          )}
        </div>
      </div>
      <div style={{ marginBottom: "20px" }}>
        <label style={labelStyle}>Scopes</label>
        <input
          style={inputStyle}
          value={scopes}
          onChange={(e) => onChange("scopes", e.target.value)}
          placeholder="openid profile email"
        />
        <FieldHint>
          Space-separated. Add{" "}
          <code style={{ fontFamily: "monospace" }}>groups</code> if your IdP
          supports a groups claim (Okta, Keycloak).
        </FieldHint>
      </div>

      <SectionHeader title="Claims Mapping" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "12px",
          marginBottom: "14px",
        }}
      >
        <div>
          <label style={labelStyle}>Email Claim</label>
          <input
            style={inputStyle}
            value={claimsEmail}
            onChange={(e) => onChange("claimsEmail", e.target.value)}
            placeholder="email"
          />
        </div>
        <div>
          <label style={labelStyle}>Name Claim</label>
          <input
            style={inputStyle}
            value={claimsName}
            onChange={(e) => onChange("claimsName", e.target.value)}
            placeholder="name"
          />
        </div>
        <div>
          <label style={labelStyle}>Groups Claim</label>
          <input
            style={inputStyle}
            value={claimsGroups}
            onChange={(e) => onChange("claimsGroups", e.target.value)}
            placeholder="groups"
          />
        </div>
      </div>
      <FieldHint>
        Claim names in the ID token that contain user email, display name, and
        group memberships. Leave blank to use defaults.
      </FieldHint>
    </>
  );
}

interface SamlFieldsProps {
  entityId: string;
  idpMetadataUrl: string;
  idpMetadataXml: string;
  nameidFormat: string;
  attrEmail: string;
  attrName: string;
  attrGroups: string;
  spEntityId: string;
  acsUrl: string;
  metadataUrl: string;
  onChange: (field: string, value: string) => void;
}

function SamlFields({
  entityId,
  idpMetadataUrl,
  idpMetadataXml,
  nameidFormat,
  attrEmail,
  attrName,
  attrGroups,
  spEntityId,
  acsUrl,
  metadataUrl,
  onChange,
}: SamlFieldsProps) {
  const [useXml, setUseXml] = useState(false);

  return (
    <>
      {/* SP Information — give these to your IdP */}
      <div
        style={{
          background: "color-mix(in srgb, var(--io-accent) 6%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--io-accent) 25%, transparent)",
          borderRadius: "var(--io-radius)",
          padding: "14px 16px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--io-accent)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginBottom: "12px",
          }}
        >
          SP Information — give these to your IdP
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}
        >
          <CopyField
            label="Entity ID (Audience URI)"
            value={spEntityId}
            hint="Your I/O instance identifier. Enter this in your IdP as the Entity ID or Audience URI."
          />
          <CopyField
            label="ACS URL (Reply URL)"
            value={acsUrl}
            hint="Assertion Consumer Service URL. Enter this in your IdP as the Reply URL or SSO URL."
          />
          <CopyField
            label="SP Metadata URL"
            value={metadataUrl}
            hint="Some IdPs can import SP metadata directly from this URL."
          />
        </div>
      </div>

      <SectionHeader title="IdP Configuration" />
      <div style={{ marginBottom: "8px" }}>
        <label style={labelStyle}>Entity ID (SP Identifier)</label>
        <input
          style={inputStyle}
          value={entityId}
          onChange={(e) => onChange("entityId", e.target.value)}
          placeholder={spEntityId}
        />
        <FieldHint>
          Your SP Entity ID sent in AuthnRequests. Defaults to the value shown
          above if left blank.
        </FieldHint>
      </div>
      <div style={{ marginBottom: "14px", marginTop: "14px" }}>
        <div>
          <label style={labelStyle}>IdP Metadata URL</label>
          <input
            style={inputStyle}
            value={idpMetadataUrl}
            onChange={(e) => onChange("idpMetadataUrl", e.target.value)}
            placeholder="https://login.microsoftonline.com/{tenant}/federationmetadata/..."
            disabled={useXml}
          />
          <FieldHint>
            The server fetches this URL automatically when the provider is
            saved. Paste it from your IdP's federation metadata link.
          </FieldHint>
        </div>
        <div style={{ marginTop: "8px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "var(--io-text-secondary)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={useXml}
              onChange={(e) => setUseXml(e.target.checked)}
            />
            Paste XML instead (air-gapped / no external access)
          </label>
        </div>
        {useXml && (
          <div style={{ marginTop: "8px" }}>
            <label style={labelStyle}>IdP Metadata XML</label>
            <textarea
              style={{
                ...inputStyle,
                fontFamily: "var(--io-font-mono, monospace)",
                fontSize: "11px",
                minHeight: "100px",
                resize: "vertical",
                lineHeight: 1.4,
              }}
              value={idpMetadataXml}
              onChange={(e) => onChange("idpMetadataXml", e.target.value)}
              placeholder="Paste the IdP federation metadata XML here"
              spellCheck={false}
            />
          </div>
        )}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label style={labelStyle}>NameID Format</label>
        <select
          style={inputStyle}
          value={nameidFormat}
          onChange={(e) => onChange("nameidFormat", e.target.value)}
        >
          <option value="email">Email Address</option>
          <option value="persistent">Persistent</option>
          <option value="transient">Transient</option>
          <option value="unspecified">Unspecified</option>
        </select>
      </div>

      <SectionHeader title="Attribute Mapping" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "12px",
          marginBottom: "14px",
        }}
      >
        <div>
          <label style={labelStyle}>Email Attribute</label>
          <input
            style={inputStyle}
            value={attrEmail}
            onChange={(e) => onChange("attrEmail", e.target.value)}
            placeholder="email"
          />
        </div>
        <div>
          <label style={labelStyle}>Name Attribute</label>
          <input
            style={inputStyle}
            value={attrName}
            onChange={(e) => onChange("attrName", e.target.value)}
            placeholder="displayName"
          />
        </div>
        <div>
          <label style={labelStyle}>Groups Attribute</label>
          <input
            style={inputStyle}
            value={attrGroups}
            onChange={(e) => onChange("attrGroups", e.target.value)}
            placeholder="groups"
          />
        </div>
      </div>
      <FieldHint>
        SAML attribute names in assertions. Azure uses long URI-form names (e.g.{" "}
        <code style={{ fontFamily: "monospace", fontSize: "10px" }}>
          http://schemas.microsoft.com/ws/2008/06/identity/claims/groups
        </code>
        ). Leave blank to use common defaults.
      </FieldHint>
    </>
  );
}

interface LdapFieldsProps {
  serverUrl: string;
  bindDn: string;
  bindPassword: string;
  searchBase: string;
  userFilter: string;
  groupSearchBase: string;
  groupFilter: string;
  usernameAttr: string;
  emailAttr: string;
  displayNameAttr: string;
  groupNameAttr: string;
  isEdit: boolean;
  onChange: (field: string, value: string) => void;
}

function LdapFields({
  serverUrl,
  bindDn,
  bindPassword,
  searchBase,
  userFilter,
  groupSearchBase,
  groupFilter,
  usernameAttr,
  emailAttr,
  displayNameAttr,
  groupNameAttr,
  isEdit,
  onChange,
}: LdapFieldsProps) {
  return (
    <>
      <SectionHeader title="Connection" />
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Server URL *</label>
        <input
          style={inputStyle}
          value={serverUrl}
          onChange={(e) => onChange("serverUrl", e.target.value)}
          placeholder="ldaps://dc01.corp.plant.com:636"
          required
        />
        <FieldHint>
          Use <code style={{ fontFamily: "monospace" }}>ldaps://</code> (port
          636) for TLS, or{" "}
          <code style={{ fontFamily: "monospace" }}>ldap://</code> with StartTLS
          (port 389). Plain LDAP is not recommended for production.
        </FieldHint>
      </div>
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Bind DN *</label>
        <input
          style={inputStyle}
          value={bindDn}
          onChange={(e) => onChange("bindDn", e.target.value)}
          placeholder="CN=io-svc,OU=Service Accounts,DC=corp,DC=plant,DC=com"
          required
        />
        <FieldHint>
          Distinguished name of the service account used to search the
          directory.
        </FieldHint>
      </div>
      <div style={{ marginBottom: "20px" }}>
        <label style={labelStyle}>Bind Password *</label>
        <input
          style={inputStyle}
          type="password"
          value={bindPassword}
          onChange={(e) => onChange("bindPassword", e.target.value)}
          placeholder={
            isEdit ? "Leave blank to keep current" : "Service account password"
          }
          required={!isEdit}
        />
        {isEdit && (
          <FieldHint>Leave blank to keep the existing password.</FieldHint>
        )}
      </div>

      <SectionHeader title="User Search" />
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Search Base *</label>
        <input
          style={inputStyle}
          value={searchBase}
          onChange={(e) => onChange("searchBase", e.target.value)}
          placeholder="OU=Users,DC=corp,DC=plant,DC=com"
          required
        />
        <FieldHint>
          Base DN to search for users. Use root DC to search all OUs.
        </FieldHint>
      </div>
      <div style={{ marginBottom: "20px" }}>
        <label style={labelStyle}>User Filter *</label>
        <input
          style={inputStyle}
          value={userFilter}
          onChange={(e) => onChange("userFilter", e.target.value)}
          placeholder="(&(sAMAccountName={username})(objectClass=user))"
          required
        />
        <FieldHint>
          LDAP filter to find users. Use{" "}
          <code style={{ fontFamily: "monospace" }}>{"{username}"}</code> as a
          placeholder for the login name.
        </FieldHint>
      </div>

      <SectionHeader title="Group Search (for Role Mapping)" />
      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Group Search Base</label>
        <input
          style={inputStyle}
          value={groupSearchBase}
          onChange={(e) => onChange("groupSearchBase", e.target.value)}
          placeholder="OU=Groups,DC=corp,DC=plant,DC=com"
        />
        <FieldHint>
          Base DN for group searches. Leave blank to skip group-based role
          mapping.
        </FieldHint>
      </div>
      <div style={{ marginBottom: "20px" }}>
        <label style={labelStyle}>Group Filter</label>
        <input
          style={inputStyle}
          value={groupFilter}
          onChange={(e) => onChange("groupFilter", e.target.value)}
          placeholder="(member:1.2.840.113556.1.4.1941:={userDN})"
        />
        <FieldHint>
          Filter to find groups a user belongs to. Use{" "}
          <code style={{ fontFamily: "monospace" }}>{"{userDN}"}</code> for the
          user's DN. The AD recursive membership OID above finds all transitive
          groups in one query.
        </FieldHint>
      </div>

      <SectionHeader title="Attribute Names" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "14px",
        }}
      >
        <div>
          <label style={labelStyle}>Username Attribute</label>
          <input
            style={inputStyle}
            value={usernameAttr}
            onChange={(e) => onChange("usernameAttr", e.target.value)}
            placeholder="sAMAccountName"
          />
          <FieldHint>AD: sAMAccountName · OpenLDAP: uid</FieldHint>
        </div>
        <div>
          <label style={labelStyle}>Email Attribute</label>
          <input
            style={inputStyle}
            value={emailAttr}
            onChange={(e) => onChange("emailAttr", e.target.value)}
            placeholder="mail"
          />
        </div>
        <div>
          <label style={labelStyle}>Display Name Attribute</label>
          <input
            style={inputStyle}
            value={displayNameAttr}
            onChange={(e) => onChange("displayNameAttr", e.target.value)}
            placeholder="displayName"
          />
        </div>
        <div>
          <label style={labelStyle}>Group Name Attribute</label>
          <input
            style={inputStyle}
            value={groupNameAttr}
            onChange={(e) => onChange("groupNameAttr", e.target.value)}
            placeholder="cn"
          />
          <FieldHint>
            Attribute used as the group value in Role Mappings.
          </FieldHint>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Add / Edit provider dialog
// ---------------------------------------------------------------------------

interface ProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: AuthProviderConfig;
}

function ProviderDialog({ open, onOpenChange, existing }: ProviderDialogProps) {
  const qc = useQueryClient();
  const isEdit = Boolean(existing);

  const [providerType, setProviderType] = useState<"oidc" | "saml" | "ldap">(
    "oidc",
  );
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [jitProvisioning, setJitProvisioning] = useState(false);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [showRaw, setShowRaw] = useState(false);
  const [configJson, setConfigJson] = useState("");
  const [configError, setConfigError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(!isEdit);

  // OIDC
  const [oidcIssuerUrl, setOidcIssuerUrl] = useState("");
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [oidcScopes, setOidcScopes] = useState("openid profile email");
  const [oidcClaimsEmail, setOidcClaimsEmail] = useState("");
  const [oidcClaimsName, setOidcClaimsName] = useState("");
  const [oidcClaimsGroups, setOidcClaimsGroups] = useState("");

  // SAML
  const [samlEntityId, setSamlEntityId] = useState("");
  const [samlIdpMetadataUrl, setSamlIdpMetadataUrl] = useState("");
  const [samlIdpMetadataXml, setSamlIdpMetadataXml] = useState("");
  const [samlNameidFormat, setSamlNameidFormat] = useState("email");
  const [samlAttrEmail, setSamlAttrEmail] = useState("");
  const [samlAttrName, setSamlAttrName] = useState("");
  const [samlAttrGroups, setSamlAttrGroups] = useState("");

  // LDAP
  const [ldapServerUrl, setLdapServerUrl] = useState(
    "ldaps://dc.corp.example.com:636",
  );
  const [ldapBindDn, setLdapBindDn] = useState("");
  const [ldapBindPassword, setLdapBindPassword] = useState("");
  const [ldapSearchBase, setLdapSearchBase] = useState("");
  const [ldapUserFilter, setLdapUserFilter] = useState(
    "(&(sAMAccountName={username})(objectClass=user))",
  );
  const [ldapGroupSearchBase, setLdapGroupSearchBase] = useState("");
  const [ldapGroupFilter, setLdapGroupFilter] = useState("");
  const [ldapUsernameAttr, setLdapUsernameAttr] = useState("sAMAccountName");
  const [ldapEmailAttr, setLdapEmailAttr] = useState("mail");
  const [ldapDisplayNameAttr, setLdapDisplayNameAttr] = useState("displayName");
  const [ldapGroupNameAttr, setLdapGroupNameAttr] = useState("cn");

  // Computed SP values for SAML
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const spEntityId = `${origin}/saml/metadata`;
  const acsUrl = `${origin}/api/auth/saml/acs`;
  const spMetadataUrl = `${origin}/api/auth/saml/metadata`;
  const oidcRedirectUri = `${origin}/api/auth/oidc/callback`;

  const guideCtx: GuideCtx = {
    redirectUri: oidcRedirectUri,
    entityId: samlEntityId || spEntityId,
    acsUrl,
    metadataUrl: spMetadataUrl,
  };

  useEffect(() => {
    if (!open) return;
    const cfg = existing?.config ?? {};
    setProviderType(existing?.provider_type ?? "oidc");
    setName(existing?.name ?? "");
    setDisplayName(existing?.display_name ?? "");
    setEnabled(existing?.enabled ?? true);
    setJitProvisioning(existing?.jit_provisioning ?? false);
    setDisplayOrder(existing?.display_order ?? 0);
    setShowRaw(false);
    setConfigError(null);
    setGuideOpen(!existing);
    // OIDC
    setOidcIssuerUrl((cfg.issuer_url as string) ?? "");
    setOidcClientId((cfg.client_id as string) ?? "");
    setOidcClientSecret("");
    setOidcScopes(
      (cfg.scopes as string[])?.join(" ") ?? "openid profile email",
    );
    setOidcClaimsEmail((cfg.claims_email as string) ?? "");
    setOidcClaimsName((cfg.claims_name as string) ?? "");
    setOidcClaimsGroups((cfg.claims_groups as string) ?? "");
    // SAML
    setSamlEntityId((cfg.entity_id as string) ?? "");
    setSamlIdpMetadataUrl((cfg.idp_metadata_url as string) ?? "");
    setSamlIdpMetadataXml((cfg.idp_metadata_xml as string) ?? "");
    setSamlNameidFormat((cfg.nameid_format as string) ?? "email");
    setSamlAttrEmail((cfg.attr_email as string) ?? "");
    setSamlAttrName((cfg.attr_name as string) ?? "");
    setSamlAttrGroups((cfg.attr_groups as string) ?? "");
    // LDAP
    setLdapServerUrl(
      (cfg.server_url as string) ?? "ldaps://dc.corp.example.com:636",
    );
    setLdapBindDn((cfg.bind_dn as string) ?? "");
    setLdapBindPassword("");
    setLdapSearchBase((cfg.search_base as string) ?? "");
    setLdapUserFilter(
      (cfg.user_filter as string) ??
        "(&(sAMAccountName={username})(objectClass=user))",
    );
    setLdapGroupSearchBase((cfg.group_search_base as string) ?? "");
    setLdapGroupFilter((cfg.group_filter as string) ?? "");
    setLdapUsernameAttr((cfg.username_attr as string) ?? "sAMAccountName");
    setLdapEmailAttr((cfg.email_attr as string) ?? "mail");
    setLdapDisplayNameAttr((cfg.display_name_attr as string) ?? "displayName");
    setLdapGroupNameAttr((cfg.group_name_attr as string) ?? "cn");
    // Raw JSON
    setConfigJson(existing ? JSON.stringify(existing.config, null, 2) : "{}");
  }, [open, existing]);

  function buildConfigFromFields(): Record<string, unknown> {
    switch (providerType) {
      case "oidc":
        return {
          issuer_url: oidcIssuerUrl.trim(),
          client_id: oidcClientId.trim(),
          ...(oidcClientSecret.trim()
            ? { client_secret: oidcClientSecret.trim() }
            : {}),
          scopes: oidcScopes.split(/[\s,]+/).filter(Boolean),
          ...(oidcClaimsEmail.trim()
            ? { claims_email: oidcClaimsEmail.trim() }
            : {}),
          ...(oidcClaimsName.trim()
            ? { claims_name: oidcClaimsName.trim() }
            : {}),
          ...(oidcClaimsGroups.trim()
            ? { claims_groups: oidcClaimsGroups.trim() }
            : {}),
        };
      case "saml":
        return {
          ...(samlEntityId.trim() ? { entity_id: samlEntityId.trim() } : {}),
          ...(samlIdpMetadataUrl.trim()
            ? { idp_metadata_url: samlIdpMetadataUrl.trim() }
            : {}),
          ...(samlIdpMetadataXml.trim()
            ? { idp_metadata_xml: samlIdpMetadataXml.trim() }
            : {}),
          nameid_format: samlNameidFormat,
          ...(samlAttrEmail.trim() ? { attr_email: samlAttrEmail.trim() } : {}),
          ...(samlAttrName.trim() ? { attr_name: samlAttrName.trim() } : {}),
          ...(samlAttrGroups.trim()
            ? { attr_groups: samlAttrGroups.trim() }
            : {}),
        };
      case "ldap":
        return {
          server_url: ldapServerUrl.trim(),
          bind_dn: ldapBindDn.trim(),
          ...(ldapBindPassword.trim()
            ? { bind_password: ldapBindPassword.trim() }
            : {}),
          search_base: ldapSearchBase.trim(),
          user_filter: ldapUserFilter.trim(),
          ...(ldapGroupSearchBase.trim()
            ? { group_search_base: ldapGroupSearchBase.trim() }
            : {}),
          ...(ldapGroupFilter.trim()
            ? { group_filter: ldapGroupFilter.trim() }
            : {}),
          username_attr: ldapUsernameAttr.trim() || "sAMAccountName",
          email_attr: ldapEmailAttr.trim() || "mail",
          display_name_attr: ldapDisplayNameAttr.trim() || "displayName",
          group_name_attr: ldapGroupNameAttr.trim() || "cn",
        };
    }
  }

  function handleOidcChange(field: string, value: string) {
    const setters: Record<string, (v: string) => void> = {
      issuerUrl: setOidcIssuerUrl,
      clientId: setOidcClientId,
      clientSecret: setOidcClientSecret,
      scopes: setOidcScopes,
      claimsEmail: setOidcClaimsEmail,
      claimsName: setOidcClaimsName,
      claimsGroups: setOidcClaimsGroups,
    };
    setters[field]?.(value);
  }

  function handleSamlChange(field: string, value: string) {
    const setters: Record<string, (v: string) => void> = {
      entityId: setSamlEntityId,
      idpMetadataUrl: setSamlIdpMetadataUrl,
      idpMetadataXml: setSamlIdpMetadataXml,
      nameidFormat: setSamlNameidFormat,
      attrEmail: setSamlAttrEmail,
      attrName: setSamlAttrName,
      attrGroups: setSamlAttrGroups,
    };
    setters[field]?.(value);
  }

  function handleLdapChange(field: string, value: string) {
    const setters: Record<string, (v: string) => void> = {
      serverUrl: setLdapServerUrl,
      bindDn: setLdapBindDn,
      bindPassword: setLdapBindPassword,
      searchBase: setLdapSearchBase,
      userFilter: setLdapUserFilter,
      groupSearchBase: setLdapGroupSearchBase,
      groupFilter: setLdapGroupFilter,
      usernameAttr: setLdapUsernameAttr,
      emailAttr: setLdapEmailAttr,
      displayNameAttr: setLdapDisplayNameAttr,
      groupNameAttr: setLdapGroupNameAttr,
    };
    setters[field]?.(value);
  }

  function handleTypeChange(t: "oidc" | "saml" | "ldap") {
    if (isEdit) return;
    setProviderType(t);
  }

  const createMutation = useMutation({
    mutationFn: (body: CreateProviderBody) => authProvidersApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth-providers"] });
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body: CreateProviderBody) =>
      authProvidersApi.update(existing!.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth-providers"] });
      onOpenChange(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setConfigError(null);

    // Validate required secrets on create
    if (!isEdit && !showRaw) {
      if (providerType === "oidc" && !oidcClientSecret.trim()) {
        setConfigError("Client Secret is required");
        return;
      }
      if (providerType === "ldap" && !ldapBindPassword.trim()) {
        setConfigError("Bind Password is required");
        return;
      }
    }

    let parsedConfig: Record<string, unknown>;
    if (showRaw) {
      try {
        parsedConfig = JSON.parse(configJson) as Record<string, unknown>;
      } catch {
        setConfigError("Invalid JSON in configuration");
        return;
      }
    } else {
      parsedConfig = buildConfigFromFields();
    }

    const body: CreateProviderBody = {
      provider_type: providerType,
      name: name.trim(),
      display_name: displayName.trim(),
      enabled,
      config: parsedConfig,
      jit_provisioning: jitProvisioning,
      display_order: displayOrder,
    };

    if (isEdit) {
      updateMutation.mutate(body);
    } else {
      createMutation.mutate(body);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError =
    (createMutation.error instanceof Error
      ? createMutation.error.message
      : null) ??
    (updateMutation.error instanceof Error
      ? updateMutation.error.message
      : null);

  const typeLabels: Record<string, string> = {
    oidc: "OIDC",
    saml: "SAML 2.0",
    ldap: "LDAP / AD",
  };

  const typeDescriptions: Record<string, string> = {
    oidc: "OpenID Connect — recommended for Entra ID, Okta, Google, Keycloak",
    saml: "SAML 2.0 — for enterprise IdPs that don't support OIDC",
    ldap: "LDAP / Active Directory — for on-premise directory authentication",
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--io-overlay, rgba(0,0,0,0.55))",
            zIndex: 100,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 101,
            background: "var(--io-surface-secondary)",
            border: "1px solid var(--io-border)",
            borderRadius: "12px",
            width: guideOpen
              ? "min(960px, calc(100vw - 32px))"
              : "min(620px, calc(100vw - 32px))",
            maxHeight: "calc(100vh - 48px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Dialog header */}
          <div
            style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid var(--io-border)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div>
                <Dialog.Title
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--io-text-primary)",
                    margin: "0 0 4px",
                  }}
                >
                  {isEdit
                    ? `Edit ${typeLabels[providerType]} Provider`
                    : "Add Authentication Provider"}
                </Dialog.Title>
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "var(--io-text-muted)",
                  }}
                >
                  {isEdit
                    ? `Editing "${existing?.display_name}"`
                    : typeDescriptions[providerType]}
                </p>
              </div>
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <button
                  type="button"
                  onClick={() => setGuideOpen((v) => !v)}
                  style={{
                    ...btnSmall,
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    color: guideOpen
                      ? "var(--io-accent)"
                      : "var(--io-text-secondary)",
                    borderColor: guideOpen
                      ? "var(--io-accent)"
                      : "var(--io-border)",
                  }}
                >
                  <span>📋</span>
                  <span>Setup Guide</span>
                </button>
                <Dialog.Close asChild>
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--io-text-muted)",
                      cursor: "pointer",
                      fontSize: "20px",
                      lineHeight: 1,
                      padding: "2px 4px",
                    }}
                  >
                    ×
                  </button>
                </Dialog.Close>
              </div>
            </div>

            {/* Provider type selector */}
            {!isEdit && (
              <div style={{ display: "flex", gap: "6px", marginTop: "14px" }}>
                {(["oidc", "saml", "ldap"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "var(--io-radius)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border:
                        providerType === t
                          ? "1.5px solid var(--io-accent)"
                          : "1px solid var(--io-border)",
                      background:
                        providerType === t
                          ? "color-mix(in srgb, var(--io-accent) 12%, transparent)"
                          : "transparent",
                      color:
                        providerType === t
                          ? "var(--io-accent)"
                          : "var(--io-text-secondary)",
                      transition: "all 0.1s ease",
                    }}
                  >
                    {typeLabels[t]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dialog body — two-column layout */}
          <div
            style={{
              display: "flex",
              flex: 1,
              overflow: "hidden",
              minHeight: 0,
            }}
          >
            {/* Left: form */}
            <form
              onSubmit={handleSubmit}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px 24px",
                minWidth: 0,
              }}
            >
              {/* Basic info */}
              <SectionHeader title="Provider Details" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <label style={labelStyle}>Internal Name *</label>
                  <input
                    style={inputStyle}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. corporate-oidc"
                    required
                    pattern="[a-z0-9_-]+"
                    title="Lowercase letters, numbers, hyphens, underscores only"
                    disabled={isEdit}
                  />
                  <FieldHint>
                    Lowercase letters, numbers, hyphens only. Cannot be changed
                    after creation.
                  </FieldHint>
                </div>
                <div>
                  <label style={labelStyle}>Display Name *</label>
                  <input
                    style={inputStyle}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Corporate SSO"
                    required
                  />
                  <FieldHint>Shown on the login page button.</FieldHint>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "20px",
                  marginBottom: "20px",
                  flexWrap: "wrap",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    color: "var(--io-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                  />
                  Enabled
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    color: "var(--io-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={jitProvisioning}
                    onChange={(e) => setJitProvisioning(e.target.checked)}
                  />
                  JIT Provisioning
                  <span
                    style={{ fontSize: "11px", color: "var(--io-text-muted)" }}
                  >
                    (auto-create users on first login)
                  </span>
                </label>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <label
                    style={{
                      fontSize: "13px",
                      color: "var(--io-text-secondary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Display Order
                  </label>
                  <input
                    style={{ ...inputStyle, width: "70px" }}
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    min={0}
                  />
                </div>
              </div>

              {/* Config toggle */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!showRaw)
                      setConfigJson(
                        JSON.stringify(buildConfigFromFields(), null, 2),
                      );
                    setShowRaw((v) => !v);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--io-accent)",
                    fontSize: "12px",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {showRaw ? "← Use Structured Fields" : "Edit Raw JSON →"}
                </button>
              </div>

              {showRaw ? (
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Configuration JSON</label>
                  <textarea
                    style={{
                      ...inputStyle,
                      fontFamily: "var(--io-font-mono, monospace)",
                      fontSize: "12px",
                      minHeight: "200px",
                      resize: "vertical",
                      lineHeight: 1.5,
                    }}
                    value={configJson}
                    onChange={(e) => setConfigJson(e.target.value)}
                    spellCheck={false}
                  />
                </div>
              ) : (
                <>
                  {providerType === "oidc" && (
                    <>
                      {/* Show redirect URI prominently */}
                      <div
                        style={{
                          background:
                            "color-mix(in srgb, var(--io-accent) 6%, transparent)",
                          border:
                            "1px solid color-mix(in srgb, var(--io-accent) 25%, transparent)",
                          borderRadius: "var(--io-radius)",
                          padding: "10px 14px",
                          marginBottom: "16px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "var(--io-accent)",
                            textTransform: "uppercase",
                            letterSpacing: "0.07em",
                            marginBottom: "6px",
                          }}
                        >
                          Give this to your IdP first
                        </div>
                        <CopyField
                          label="Redirect URI (Authorized Callback URL)"
                          value={oidcRedirectUri}
                          hint="Register this exact URL in your IdP before copying the Client ID."
                        />
                      </div>
                      <OidcFields
                        issuerUrl={oidcIssuerUrl}
                        clientId={oidcClientId}
                        clientSecret={oidcClientSecret}
                        scopes={oidcScopes}
                        claimsEmail={oidcClaimsEmail}
                        claimsName={oidcClaimsName}
                        claimsGroups={oidcClaimsGroups}
                        isEdit={isEdit}
                        onChange={handleOidcChange}
                      />
                    </>
                  )}
                  {providerType === "saml" && (
                    <SamlFields
                      entityId={samlEntityId}
                      idpMetadataUrl={samlIdpMetadataUrl}
                      idpMetadataXml={samlIdpMetadataXml}
                      nameidFormat={samlNameidFormat}
                      attrEmail={samlAttrEmail}
                      attrName={samlAttrName}
                      attrGroups={samlAttrGroups}
                      spEntityId={spEntityId}
                      acsUrl={acsUrl}
                      metadataUrl={spMetadataUrl}
                      onChange={handleSamlChange}
                    />
                  )}
                  {providerType === "ldap" && (
                    <LdapFields
                      serverUrl={ldapServerUrl}
                      bindDn={ldapBindDn}
                      bindPassword={ldapBindPassword}
                      searchBase={ldapSearchBase}
                      userFilter={ldapUserFilter}
                      groupSearchBase={ldapGroupSearchBase}
                      groupFilter={ldapGroupFilter}
                      usernameAttr={ldapUsernameAttr}
                      emailAttr={ldapEmailAttr}
                      displayNameAttr={ldapDisplayNameAttr}
                      groupNameAttr={ldapGroupNameAttr}
                      isEdit={isEdit}
                      onChange={handleLdapChange}
                    />
                  )}
                </>
              )}

              {configError && (
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--io-danger)",
                    marginBottom: "12px",
                  }}
                >
                  {configError}
                </p>
              )}

              {mutationError && (
                <div
                  style={{
                    background: "var(--io-danger-subtle)",
                    border: "1px solid var(--io-danger)",
                    borderRadius: "var(--io-radius)",
                    padding: "8px 12px",
                    color: "var(--io-danger)",
                    fontSize: "13px",
                    marginBottom: "16px",
                  }}
                >
                  {mutationError}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  paddingTop: "8px",
                }}
              >
                <Dialog.Close asChild>
                  <button type="button" style={btnSecondary}>
                    Cancel
                  </button>
                </Dialog.Close>
                <button type="submit" style={btnPrimary} disabled={isPending}>
                  {isPending
                    ? "Saving…"
                    : isEdit
                      ? "Save Changes"
                      : "Add Provider"}
                </button>
              </div>
            </form>

            {/* Right: setup guide */}
            {guideOpen && (
              <div
                style={{
                  width: "320px",
                  flexShrink: 0,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <SetupGuide type={providerType} ctx={guideCtx} />
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Provider row
// ---------------------------------------------------------------------------

interface ProviderRowProps {
  provider: AuthProviderConfig;
}

function ProviderRow({ provider }: ProviderRowProps) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => authProvidersApi.delete(provider.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth-providers"] }),
  });

  const handleTest = async () => {
    setTesting(true);
    setTestStatus(null);
    try {
      const result = await api.post<{ message: string }>(
        `/api/auth/admin/providers/${provider.id}/test`,
        {},
      );
      if (result.success) {
        setTestStatus({
          ok: true,
          message:
            (result.data as { message?: string }).message ??
            "Connection successful",
        });
      } else {
        const err = result as { success: false; error?: { message: string } };
        setTestStatus({
          ok: false,
          message: err.error?.message ?? "Test failed",
        });
      }
    } catch {
      setTestStatus({ ok: false, message: "Connection test failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <tr style={{ borderBottom: "1px solid var(--io-border)" }}>
        <td style={cellStyle}>
          <div style={{ fontWeight: 500, color: "var(--io-text-primary)" }}>
            {provider.display_name}
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--io-text-muted)",
              fontFamily: "var(--io-font-mono, monospace)",
            }}
          >
            {provider.name}
          </div>
        </td>
        <td style={cellStyle}>
          <TypeBadge type={provider.provider_type} />
        </td>
        <td style={cellStyle}>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: provider.enabled
                ? "var(--io-success)"
                : "var(--io-text-muted)",
            }}
          >
            {provider.enabled ? "Enabled" : "Disabled"}
          </span>
          {provider.jit_provisioning && (
            <span
              style={{
                marginLeft: "8px",
                fontSize: "10px",
                padding: "1px 5px",
                borderRadius: "999px",
                background: "var(--io-surface-sunken)",
                color: "var(--io-text-muted)",
                border: "1px solid var(--io-border)",
              }}
            >
              JIT
            </span>
          )}
        </td>
        <td style={{ ...cellStyle, textAlign: "right" }}>
          <div
            style={{
              display: "flex",
              gap: "6px",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            {testStatus && (
              <span
                style={{
                  fontSize: "12px",
                  color: testStatus.ok
                    ? "var(--io-success)"
                    : "var(--io-danger)",
                  maxWidth: "200px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {testStatus.message}
              </span>
            )}
            <button style={btnSmall} disabled={testing} onClick={handleTest}>
              {testing ? "Testing…" : "Test"}
            </button>
            <button style={btnSmall} onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Hide Mappings" : "Mappings"}
            </button>
            <button style={btnSmall} onClick={() => setEditOpen(true)}>
              Edit
            </button>
            <button
              style={{
                ...btnSmall,
                color: "var(--io-danger)",
                borderColor: "var(--io-danger)",
              }}
              disabled={deleteMutation.isPending}
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={4} style={{ padding: "0 14px 14px" }}>
            <RoleMappings provider={provider} />
          </td>
        </tr>
      )}

      <ProviderDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existing={provider}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`Delete "${provider.display_name}"?`}
        description="This auth provider will be permanently removed. Users who sign in via this provider will no longer be able to authenticate."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AuthProvidersPage() {
  const [addOpen, setAddOpen] = useState(false);

  const {
    data: providersResult,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["auth-providers"],
    queryFn: () => authProvidersApi.list(),
  });

  const providers: AuthProviderConfig[] = providersResult?.success
    ? providersResult.data
    : [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "24px",
          gap: "16px",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
              margin: "0 0 4px",
            }}
          >
            Authentication Providers
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "var(--io-text-muted)",
              margin: 0,
            }}
          >
            Configure OIDC, SAML 2.0, and LDAP / Active Directory identity
            providers for single sign-on. Each provider can have group-to-role
            mappings for automatic role assignment.
          </p>
        </div>
        <button
          style={{ ...btnPrimary, whiteSpace: "nowrap" }}
          onClick={() => setAddOpen(true)}
        >
          + Add Provider
        </button>
      </div>

      <div
        style={{
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          <p
            style={{
              padding: "24px",
              fontSize: "13px",
              color: "var(--io-text-muted)",
            }}
          >
            Loading providers…
          </p>
        ) : error ? (
          <p
            style={{
              padding: "24px",
              fontSize: "13px",
              color: "var(--io-danger)",
            }}
          >
            Failed to load providers.
          </p>
        ) : providers.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔐</div>
            <p
              style={{
                fontSize: "14px",
                color: "var(--io-text-secondary)",
                margin: "0 0 8px",
                fontWeight: 500,
              }}
            >
              No SSO providers configured
            </p>
            <p
              style={{
                fontSize: "13px",
                color: "var(--io-text-muted)",
                margin: "0 0 20px",
                maxWidth: "400px",
                marginInline: "auto",
              }}
            >
              Add an OIDC, SAML, or LDAP provider to enable single sign-on.
              Setup guides are included for Microsoft Entra ID, Okta, Google
              Workspace, and more.
            </p>
            <button style={btnPrimary} onClick={() => setAddOpen(true)}>
              Add your first provider
            </button>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--io-border)" }}>
                {["Provider", "Type", "Status", "Actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--io-text-muted)",
                      textAlign: h === "Actions" ? "right" : "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <ProviderRow key={p.id} provider={p} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ProviderDialog open={addOpen} onOpenChange={setAddOpen} />

      <style>{`
        input[type="checkbox"] { accent-color: var(--io-accent); cursor: pointer; }
        input[type="radio"] { accent-color: var(--io-accent); cursor: pointer; }
        select option { background: var(--io-surface-secondary); color: var(--io-text-primary); }
      `}</style>
    </div>
  );
}
