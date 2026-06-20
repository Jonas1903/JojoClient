import { useEffect, useState } from "react";
import type { Profile } from "../main/types";
import { MC_VERSIONS } from "../lib/utils";
import type { Account, AccountData } from "../types";

// ============================================
// New Installation Modal
// ============================================

export function NewInstallationModal({
  profiles,
  onClose,
  onCreate,
  basePath,
}: {
  profiles: Profile[];
  onClose: () => void;
  onCreate: (profileId: string, name: string, minecraftVersion: string, description: string) => void;
  basePath: string | null;
}) {
  const defaultProfile = profiles[0];
  const [name, setName] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(MC_VERSIONS[0] || "");
  const [versionSearch, setVersionSearch] = useState("");
  const [profileId, setProfileId] = useState(defaultProfile?.id || "");
  const [profileSearch, setProfileSearch] = useState("");
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const selectedProfile = profiles.find((p) => p.id === profileId);

  useEffect(() => {
    if (!profileId && profiles.length > 0) {
      const initialProfile = profiles[0];
      if (initialProfile) {
        setProfileId(initialProfile.id);
      }
    }
  }, [profiles, profileId]);

  useEffect(() => {
    if (!selectedVersion) {
      setSelectedVersion(MC_VERSIONS[0] || "");
      setVersionSearch("");
    }
  }, [selectedVersion]);

  const filteredVersions = versionSearch.trim()
    ? MC_VERSIONS.filter((v) => v.includes(versionSearch))
    : MC_VERSIONS;

  const filteredProfiles = profileSearch.trim()
    ? profiles.filter((p) => p.name.toLowerCase().includes(profileSearch.toLowerCase()))
    : profiles;

  const profileInputValue = profileSearch !== "" ? profileSearch : selectedProfile?.name || "";

  const destinationPath =
    selectedProfile && name.trim() && basePath
      ? `${basePath}\\profiles\\${selectedProfile.name}\\installations\\${name.trim().replace(/\s+/g, "-").toLowerCase()}`
      : "";

  function handleSelectVersion(version: string) {
    setSelectedVersion(version);
    setVersionSearch(version);
    setShowVersionDropdown(false);
  }

  function handleSelectProfile(profile: Profile) {
    setProfileId(profile.id);
    setProfileSearch("");
    setShowProfileDropdown(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal new-installation-modal" onClick={(e) => e.stopPropagation()}>
        <h3>New Installation</h3>

        <div className="form-group">
          <label>Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Installation"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>Version:</label>
          <div className="searchable-select">
            <input
              type="text"
              value={versionSearch}
              onChange={(e) => {
                setVersionSearch(e.target.value);
                setShowVersionDropdown(true);
              }}
              onFocus={() => {
                if (!versionSearch && selectedVersion) {
                  setVersionSearch("");
                }
                setShowVersionDropdown(true);
              }}
              placeholder={selectedVersion || "Search or select version..."}
            />
            {showVersionDropdown && (
              <div className="dropdown-list">
                {filteredVersions.map((v) => (
                  <div
                    key={v}
                    className={`dropdown-item ${selectedVersion === v ? "selected" : ""}`}
                    onClick={() => handleSelectVersion(v)}
                  >
                    {v}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Profile:</label>
          <div className="searchable-select">
            <input
              type="text"
              value={profileInputValue}
              onChange={(e) => {
                setProfileSearch(e.target.value);
                setShowProfileDropdown(true);
              }}
              onFocus={() => {
                setProfileSearch("");
                setShowProfileDropdown(true);
              }}
              onBlur={() => {
                setProfileSearch("");
                setShowProfileDropdown(false);
              }}
              placeholder={selectedProfile?.name || "Search or select profile..."}
            />
            {showProfileDropdown && (
              <div className="dropdown-list">
                {filteredProfiles.map((p) => (
                  <div
                    key={p.id}
                    className={`dropdown-item ${profileId === p.id ? "selected" : ""}`}
                    onMouseDown={() => handleSelectProfile(p)}
                  >
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Destination:</label>
          <div className="destination-path">
            {destinationPath || "Select a profile and enter a name"}
          </div>
        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={() => onCreate(profileId, name, selectedVersion || MC_VERSIONS[0] || "", "")}
            disabled={!name.trim() || !profileId}
          >
            Create Installation
          </button>
          <button className="btn btn-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Account Modal
// ============================================

export function AccountModal({
  account,
  accounts,
  authLoading,
  onLogin,
  onLogout,
  onSelectAccount,
  onClose,
}: {
  account: Account;
  accounts: AccountData[];
  authLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onSelectAccount: (acc: AccountData) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal account-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Accounts</h3>

        {account && (
          <div className="current-account-indicator">
            <img
              src={`https://mc-heads.net/avatar/${account.uuid}/32`}
              alt={account.username}
              className="current-account-head"
            />
            <div className="current-account-info">
              <span className="current-account-label">Active Account</span>
              <span className="current-account-name">{account.username}</span>
            </div>
          </div>
        )}

        <div className="accounts-list">
          <div className="accounts-list-header">
            <span>Your Accounts</span>
          </div>
          {accounts.length === 0 ? (
            <div className="no-accounts">
              <p>No accounts added yet</p>
            </div>
          ) : (
            accounts.map((acc) => (
              <div
                key={acc.uuid}
                className={`account-list-item ${account?.uuid === acc.uuid ? "selected" : ""}`}
                onClick={() => onSelectAccount(acc)}
              >
                <img
                  src={`https://mc-heads.net/avatar/${acc.uuid}/40`}
                  alt={acc.username}
                  className="account-list-head"
                />
                <div className="account-list-info">
                  <span className="account-list-name">{acc.username}</span>
                  <span className="account-list-uuid">{acc.uuid.substring(0, 8)}...</span>
                </div>
                {account?.uuid === acc.uuid && (
                  <span className="account-active-badge">Active</span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="account-actions">
          <button
            className="btn btn-primary add-account-btn"
            onClick={onLogin}
            disabled={authLoading}
          >
            {authLoading ? "Adding..." : "+ Add Account"}
          </button>
          {account && (
            <button className="btn btn-danger logout-btn" onClick={onLogout}>
              🚪 Log Out
            </button>
          )}
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Profile Modal
// ============================================

export function ProfileModal({
  profiles,
  editingProfile,
  onClose,
  onSave,
}: {
  profiles: Profile[];
  editingProfile: Profile | null;
  onClose: () => void;
  onSave: (profileId: string) => void;
}) {
  const [selectedProfileId, setSelectedProfileId] = useState(
    editingProfile?.id || profiles[0]?.id || ""
  );

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal profile-select-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Select Profile</h3>

        <div className="profile-list">
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`profile-list-item ${selectedProfileId === p.id ? "selected" : ""}`}
              onClick={() => setSelectedProfileId(p.id)}
            >
              <span className="profile-list-name">{p.name}</span>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button
            className="btn btn-primary"
            onClick={() => onSave(selectedProfileId)}
            disabled={!selectedProfile}
          >
            Save
          </button>
          <button className="btn btn-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
