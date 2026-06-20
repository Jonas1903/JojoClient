import React, { useEffect, useState } from "react";
import type { Profile, ModIssue } from "../main/types";
import { IconInfo, IconFolder, IconRefresh, IconTrash } from "../components/icons";
import { usePageHint, PageHintCallout } from "../lib/utils";
import type { Installation } from "../types";

export function ProfilesScreen({
  profiles,
  installations,
  basePath,
  onRefresh,
  onInfo,
  onConfirm,
  onReloadInstallations,
  onRefreshInstallationModIssues,
  onSetInstallationModIssues,
  onBusy,
  onBusyDone,
}: {
  profiles: Profile[];
  installations: Installation[];
  basePath: string | null;
  onRefresh: () => void;
  onInfo: (title: string, message: string) => void;
  onConfirm: (title: string, message: string, onConfirm: () => void) => void;
  onReloadInstallations: () => Promise<void> | void;
  onRefreshInstallationModIssues: (profileId: string) => Promise<void> | void;
  onSetInstallationModIssues: React.Dispatch<React.SetStateAction<Record<string, ModIssue[]>>>;
  onBusy: (message: string) => void;
  onBusyDone: () => void;
}) {
  const pageHint = usePageHint("profiles");
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?.id || "");
  const [profileName, setProfileName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [profileModCount, setProfileModCount] = useState(0);
  const [exportSettingsModal, setExportSettingsModal] = useState<{ show: boolean; bundle: string }>({
    show: false,
    bundle: "",
  });
  const [exportProfileModal, setExportProfileModal] = useState<{ show: boolean; bundle: string; filePath?: string }>({
    show: false,
    bundle: "",
  });
  const [importProfileModal, setImportProfileModal] = useState<{ show: boolean; code: string }>({
    show: false,
    code: "",
  });
  const [importSettingsModal, setImportSettingsModal] = useState<{ show: boolean; code: string }>({
    show: false,
    code: "",
  });

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);
  const profileInstallations = installations.filter(i => i.profileId === selectedProfileId);
  const otherProfiles = profiles.filter((p) => p.id !== selectedProfileId);
  const canDeleteProfile = !!selectedProfile && !selectedProfile.isDefault && otherProfiles.length > 0;

  useEffect(() => {
    if (profiles.length === 0) {
      if (selectedProfileId) setSelectedProfileId("");
      return;
    }
    if (!profiles.some((p) => p.id === selectedProfileId)) {
      setSelectedProfileId(profiles[0]?.id || "");
    }
  }, [profiles, selectedProfileId]);
  
  useEffect(() => {
    let cancelled = false;
    async function loadProfileModCount() {
      if (!selectedProfileId) {
        setProfileModCount(0);
        return;
      }
      try {
        const result = await window.jojoclient.listProfileMods(selectedProfileId);
        if (!cancelled) {
          setProfileModCount(result.ok && result.mods ? result.mods.length : 0);
        }
      } catch {
        if (!cancelled) setProfileModCount(0);
      }
    }
    void loadProfileModCount();
    return () => {
      cancelled = true;
    };
  }, [selectedProfileId]);

  useEffect(() => {
    if (selectedProfile) {
      setProfileName(selectedProfile.name);
    }
  }, [selectedProfile]);

  async function handleSaveName() {
    if (!selectedProfile || !profileName.trim()) return;
    try {
      await window.jojoclient.updateProfile({
        id: selectedProfile.id,
        updates: { name: profileName }
      });
      onRefresh();
    } catch (e) {
      console.error("Failed to update profile:", e);
    }
  }

  async function handleCreateProfile() {
    if (!newProfileName.trim()) return;
    try {
      const result = await window.jojoclient.createProfile({
        name: newProfileName,
      });
      if (result.ok && result.profile) {
        setSelectedProfileId(result.profile.id);
        setIsCreating(false);
        setNewProfileName("");
        onRefresh();
      }
    } catch (e) {
      console.error("Failed to create profile:", e);
    }
  }

  async function handleDeleteProfile() {
    if (!selectedProfile) return;
    if (!canDeleteProfile) {
      onInfo("Delete Profile", "You must keep at least one non-default profile.");
      return;
    }
    onConfirm(
      "Delete Profile",
      `Are you sure you want to delete "${selectedProfile.name}"? Its installations will be moved to the oldest profile.`,
      async () => {
        try {
          const result = await window.jojoclient.deleteProfile(selectedProfile.id);
          if (!result.ok) {
            onInfo("Delete Profile", result.error || "Failed to delete profile.");
            return;
          }
          setSelectedProfileId("");
          onRefresh();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          onInfo("Delete Profile", msg || "Failed to delete profile.");
        }
      }
    );
  }

  async function handleExportProfile() {
    if (!selectedProfile) return;
    if (!window.jojoclient.exportProfileCode) {
      onInfo("Export", "Profile export API not available. Please restart the app.");
      return;
    }
    onBusy("Preparing export...");
    try {
      const result = await window.jojoclient.exportProfileCode(selectedProfile.id);
      if (result.ok && result.bundle) {
        setExportProfileModal({ show: true, bundle: result.bundle, filePath: undefined });
      } else {
        onInfo("Export failed", result.error || "Unknown error");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Export failed", msg || "Unknown error");
    } finally {
      onBusyDone();
    }
  }

  async function handleSyncModsToInstallations() {
    if (!selectedProfile) return;
    if (!window.jojoclient.syncProfileModsToInstallations) {
      onInfo("Sync", "Sync API not available. Please restart the app.");
      return;
    }
    onBusy("Syncing mods to all installations...");
    try {
      const result = await window.jojoclient.syncProfileModsToInstallations(selectedProfile.id);
      if (result.ok) {
        const syncResults = result.results ?? [];
        if (syncResults.length > 0) {
          onSetInstallationModIssues((prev) => {
            const next = { ...prev };
            for (const entry of syncResults) {
              if (entry.issues && entry.issues.length > 0) {
                next[entry.installationId] = entry.issues;
              } else {
                delete next[entry.installationId];
              }
            }
            return next;
          });
        }
        await onReloadInstallations();
        await onRefreshInstallationModIssues(selectedProfile.id);
        const totalFailed = (result.results || []).reduce((sum, r) => sum + r.failed.length, 0);
        if (totalFailed > 0) {
          onInfo("Sync Complete", `Synced to ${result.syncedCount} installations. ${totalFailed} mod(s) failed to download.`);
        } else {
          onInfo("Sync Complete", `Successfully synced mods to ${result.syncedCount} installation(s).`);
        }
      } else {
        onInfo("Sync failed", result.error || "Unknown error");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Sync failed", msg || "Unknown error");
    } finally {
      onBusyDone();
    }
  }

  async function handleCopyProfileExportCode() {
    if (!exportProfileModal.bundle) return;
    try {
      await navigator.clipboard.writeText(exportProfileModal.bundle);
      onInfo("Export", "Profile code copied to clipboard.");
    } catch {
      onInfo("Export", "Failed to copy code.");
    }
  }

  async function handleSaveProfileExportToFile() {
    if (!selectedProfile) return;
    if (!window.jojoclient.exportProfileFile) {
      onInfo("Export", "Profile export API not available. Please restart the app.");
      return;
    }
    onBusy("Exporting profile...");
    try {
      const result = await window.jojoclient.exportProfileFile(selectedProfile.id);
      if (result.ok && result.exportDir) {
        onInfo("Export", `Profile exported to folder: ${result.exportDir}`);
        setExportProfileModal({ show: false, bundle: "", filePath: undefined });
      } else if (!result.canceled) {
        onInfo("Export failed", result.error || "Unknown error");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Export failed", msg || "Unknown error");
    } finally {
      onBusyDone();
    }
  }

  async function handleImportProfile() {
    setImportProfileModal({ show: true, code: "" });
  }

  async function handleLoadProfileImportFromFile() {
    try {
      if (!window.jojoclient.loadProfileBundleFromFile) {
        onInfo("Import", "Profile import API not available. Please restart the app.");
        return;
      }
      const result = await window.jojoclient.loadProfileBundleFromFile();
      if (result.ok && result.bundle) {
        setImportProfileModal({ show: true, code: result.bundle });
      } else if (!result.canceled) {
        onInfo("Import failed", result.error || "Unknown error");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Import failed", msg || "Unknown error");
    }
  }

  async function handleImportProfileFromFolder() {
    if (!window.jojoclient.importProfileFile) {
      onInfo("Import", "Profile import API not available. Please restart the app.");
      return;
    }
    onBusy("Importing profile...");
    try {
      const result = await window.jojoclient.importProfileFile();
      if (result.ok && result.profileId) {
        setSelectedProfileId(result.profileId);
        setIsCreating(false);
        setNewProfileName("");
        onRefresh();
        onInfo("Import", `Profile imported: ${result.profileName || "(Imported)"}`);
        setImportProfileModal({ show: false, code: "" });
      } else if (!result.canceled) {
        onInfo("Import failed", result.error || "Unknown error");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Import failed", msg || "Unknown error");
    } finally {
      onBusyDone();
    }
  }

  async function handleImportProfileFromCode() {
    if (!window.jojoclient.importProfileFromCode) {
      onInfo("Import", "Profile import API not available. Please restart the app.");
      return;
    }
    if (!importProfileModal.code.trim()) {
      onInfo("Import", "Profile code is empty.");
      return;
    }
    onBusy("Importing profile...");
    try {
      const result = await window.jojoclient.importProfileFromCode(importProfileModal.code.trim());
      if (result.ok && result.profileId) {
        setSelectedProfileId(result.profileId);
        setIsCreating(false);
        setNewProfileName("");
        onRefresh();

        const details: string[] = [];
        if (result.hasModsJson) {
          details.push("Mods list imported");
        }
        if (result.templateFilesCount && result.templateFilesCount > 0) {
          details.push(`${result.templateFilesCount} settings files`);
        }
        const summary = details.length > 0 ? ` (${details.join(", ")})` : "";
        onInfo("Import", `Profile imported: ${result.profileName || "(Imported)"}${summary}`);
        setImportProfileModal({ show: false, code: "" });
      } else {
        onInfo("Import failed", result.error || "Unknown error");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Import failed", msg || "Unknown error");
    } finally {
      onBusyDone();
    }
  }

  async function handleExportSettings() {
    if (!selectedProfile) return;
    if (!window.jojoclient.exportProfileSettingsBundle) {
      onInfo("Export", "Settings export API not available. Please restart the app.");
      return;
    }
    onBusy("Exporting settings...");
    try {
      const result = await window.jojoclient.exportProfileSettingsBundle(selectedProfile.id);
      if (!result.ok || !result.bundle) {
        throw new Error(result.error || "Export failed");
      }
      setExportSettingsModal({ show: true, bundle: result.bundle });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Export", msg);
    } finally {
      onBusyDone();
    }
  }

  async function handleCopySettingsCode() {
    if (!exportSettingsModal.bundle) return;
    try {
      await navigator.clipboard.writeText(exportSettingsModal.bundle);
      onInfo("Export", "Settings code copied to clipboard.");
    } catch {
      onInfo("Export", "Failed to copy code.");
    }
  }

  async function handleImportSettings() {
    if (!selectedProfile) return;
    const bundle = importSettingsModal.code.trim();
    if (!bundle) {
      onInfo("Import", "Paste a settings code first.");
      return;
    }
    if (!window.jojoclient.importProfileSettingsBundle) {
      onInfo("Import", "Settings import API not available. Please restart the app.");
      return;
    }
    onBusy("Importing settings...");
    try {
      const result = await window.jojoclient.importProfileSettingsBundle({
        profileId: selectedProfile.id,
        bundle,
      });
      if (!result.ok) {
        throw new Error(result.error || "Import failed");
      }
      setImportSettingsModal({ show: false, code: "" });
      if (result.applied) {
        onInfo("Import complete", "Settings applied to profile template.");
      } else {
        onInfo("Import skipped", result.reason || "Settings were not applied.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Import", msg);
    } finally {
      onBusyDone();
    }
  }

  async function openProfileFolder() {
    if (!basePath || !selectedProfile) return;
    const profilePath = `${basePath}\\profiles\\${selectedProfile.name}`;
    try {
      await window.jojoclient.openFolder(profilePath);
    } catch (e) {
      console.error("Failed to open folder:", e);
    }
  }

  return (
    <div className="profiles-screen">
      {/* Left Panel - Profile List */}
      <div className="profiles-list-panel">
        <div className="profiles-list-header">
          <h3>Profiles</h3>
          <button className="hint-trigger-btn" onClick={pageHint.show} title="What is this page?">
            <IconInfo />
          </button>
        </div>

        <div className="profiles-list">
          {profiles.map(p => (
            <div
              key={p.id}
              className={`profiles-list-item ${selectedProfileId === p.id ? 'selected' : ''}`}
              onClick={() => setSelectedProfileId(p.id)}
            >
              <span className="profiles-item-name">{p.name}</span>
            </div>
          ))}
        </div>

        <button 
          className="new-profile-btn-list"
          onClick={() => setIsCreating(true)}
        >
          + New Profile
        </button>
      </div>

      {/* Right Panel - Profile Details */}
      <div className="profiles-detail-panel">
        {pageHint.visible && (
          <PageHintCallout
            text="Profiles are templates holding your mods and settings."
            items={[
              "Each profile can have multiple Installations — independent game instances you can play separately.",
              "Settings you change in-game are saved back to the profile template automatically on clean exit.",
              "Export a profile to back it up or share it as a .zip file (includes mods, configs, and shaders).",
            ]}
            onDismiss={pageHint.dismiss}
          />
        )}
        {isCreating ? (
          /* Create New Profile Form */
          <div className="create-profile-form">
            <h3>Create New Profile</h3>
            
            <div className="form-group">
              <label>Profile Name:</label>
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="My Profile"
                autoFocus
              />
            </div>

            <div className="form-group">
              <button className="btn btn-secondary" onClick={handleImportProfile}>
                📥 Import Profile
              </button>
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleCreateProfile}>
                Create Profile
              </button>
              <button className="btn btn-cancel" onClick={() => setIsCreating(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : selectedProfile ? (
          /* Selected Profile Details */
          <>
            <div className="profile-header">
              <div className="profile-name-row">
                <span className="profile-name-edit-icon" aria-hidden="true">✎</span>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className="profile-name-input"
                />
              </div>
              <div className="profile-mod-count">
                Mods: {profileModCount}
              </div>
            </div>

            {/* Installations using this profile */}
            <div className="profile-installations-section">
              <h4>Installations ({profileInstallations.length})</h4>
              {profileInstallations.length === 0 ? (
                <p className="no-installations-msg">No installations using this profile</p>
              ) : (
                <div className="profile-installations-list">
                  {profileInstallations.map(inst => (
                    <div key={inst.id} className="profile-installation-item">
                      <span className="inst-name">{inst.name}</span>
                      <span className="inst-mc-version">{inst.minecraftVersion}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Minecraft Settings Section */}
            <div className="settings-section">
              <h4>Minecraft Settings</h4>
              <p className="settings-description">
                Export or import default Minecraft settings for this profile.
              </p>
              <div className="profile-actions-section">
                <button className="btn btn-secondary" onClick={handleExportSettings}>
                  📤 Export Settings
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setImportSettingsModal({ show: true, code: "" })}
                >
                  📥 Import Settings
                </button>
              </div>
            </div>

            {/* Profile Actions */}
            <div className="profile-actions-section">
              <div className="profile-actions-left">
                <button className="btn btn-secondary" onClick={openProfileFolder}>
                  <IconFolder /> Open Folder
                </button>
                <button className="btn btn-secondary" onClick={handleExportProfile}>
                  Export Profile
                </button>
                <button className="btn btn-secondary" onClick={handleSyncModsToInstallations}>
                  <IconRefresh /> Sync Mods
                </button>
              </div>
              <div className="profile-actions-right">
                <button className="btn btn-danger" onClick={handleDeleteProfile} disabled={!canDeleteProfile}>
                  <IconTrash /> Delete Profile
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="no-profile-selected">
            <p>Select a profile to view details</p>
          </div>
        )}
      </div>

      {exportSettingsModal.show && (
        <div className="modal-overlay" onClick={() => setExportSettingsModal({ show: false, bundle: "" })}>
          <div className="modal mods-share-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Export Settings</h3>
            <p className="mods-share-hint">
              Share this code to import default Minecraft settings into another profile.
            </p>
            <textarea
              className="mods-share-textarea"
              readOnly
              value={exportSettingsModal.bundle}
            />
            <div className="mods-share-actions">
              <button className="btn btn-secondary" onClick={handleCopySettingsCode}>
                Copy Code
              </button>
              <button
                className="btn btn-cancel"
                onClick={() => setExportSettingsModal({ show: false, bundle: "" })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {exportProfileModal.show && (
        <div className="modal-overlay" onClick={() => setExportProfileModal({ show: false, bundle: "" })}>
          <div className="modal mods-share-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Export Profile</h3>
            <p className="mods-share-hint">
              Export the profile to a folder (includes mods, configs, and settings).
            </p>
            <div className="mods-share-actions" style={{ marginBottom: "12px" }}>
              <button className="btn btn-primary" onClick={handleSaveProfileExportToFile}>
                📁 Export to Folder
              </button>
            </div>
            <p className="mods-share-hint" style={{ marginTop: "8px", fontSize: "12px", color: "#888" }}>
              Or copy legacy code for sharing (no mod files included):
            </p>
            <textarea
              className="mods-share-textarea"
              readOnly
              value={exportProfileModal.bundle}
              style={{ height: "80px" }}
            />
            <div className="mods-share-actions">
              <button className="btn btn-secondary" onClick={handleCopyProfileExportCode}>
                Copy Code
              </button>
              <button
                className="btn btn-cancel"
                onClick={() => setExportProfileModal({ show: false, bundle: "" })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {importProfileModal.show && (
        <div className="modal-overlay" onClick={() => setImportProfileModal({ show: false, code: "" })}>
          <div className="modal mods-share-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import Profile</h3>
            <p className="mods-share-hint">
              Import a profile folder, or paste a legacy profile code.
            </p>
            <div className="mods-share-actions" style={{ marginBottom: "12px" }}>
              <button className="btn btn-primary" onClick={handleImportProfileFromFolder}>
                📁 Import Folder
              </button>
            </div>
            <p className="mods-share-hint" style={{ marginTop: "8px", fontSize: "12px", color: "#888" }}>
              Or paste a legacy profile code:
            </p>
            <textarea
              className="mods-share-textarea"
              value={importProfileModal.code}
              onChange={(e) => setImportProfileModal({ show: true, code: e.target.value })}
              placeholder="Paste legacy profile code here..."
              style={{ height: "80px" }}
            />
            <div className="mods-share-actions">
              <button className="btn btn-secondary" onClick={handleLoadProfileImportFromFile}>
                Load Legacy File
              </button>
              <button className="btn btn-secondary" onClick={handleImportProfileFromCode} disabled={!importProfileModal.code.trim()}>
                Import Code
              </button>
              <button
                className="btn btn-cancel"
                onClick={() => setImportProfileModal({ show: false, code: "" })}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {importSettingsModal.show && (
        <div className="modal-overlay" onClick={() => setImportSettingsModal({ show: false, code: "" })}>
          <div className="modal mods-share-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import Settings</h3>
            <p className="mods-share-hint">
              Paste a settings code exported from another profile.
            </p>
            <textarea
              className="mods-share-textarea"
              value={importSettingsModal.code}
              onChange={(e) => setImportSettingsModal({ show: true, code: e.target.value })}
              placeholder="Paste settings code here..."
            />
            <div className="mods-share-actions">
              <button className="btn btn-primary" onClick={handleImportSettings}>
                Import
              </button>
              <button
                className="btn btn-cancel"
                onClick={() => setImportSettingsModal({ show: false, code: "" })}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
