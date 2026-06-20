import { useEffect, useState } from "react";
import { IconInfo } from "../components/icons";
import { usePageHint, PageHintCallout } from "../lib/utils";
import type { Settings } from "../types";

export function SettingsScreen({
  settings,
  theme,
  onThemeChange,
  onChangeBaseFolder,
}: {
  settings: Settings;
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
  onChangeBaseFolder: () => void;
}) {
  const pageHint = usePageHint("settings");
  const [isChangingFolder, setIsChangingFolder] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [appVersion, setAppVersion] = useState<string>("...");

  useEffect(() => {
    window.jojoclient.getAppVersion().then(setAppVersion).catch(() => setAppVersion("unknown"));
  }, []);

  const handleChangeFolder = async () => {
    setShowConfirmDialog(false);
    setIsChangingFolder(true);
    try {
      await onChangeBaseFolder();
    } finally {
      setIsChangingFolder(false);
    }
  };

  return (
    <div className="settings-screen">
      <div className="settings-content">
        <div className="settings-title-row">
          <h2>Settings</h2>
          <button className="hint-trigger-btn" onClick={pageHint.show} title="What is this page?">
            <IconInfo />
          </button>
        </div>
        {pageHint.visible && (
          <PageHintCallout
            text="Configure your launcher preferences and game data storage location."
            items={[
              "The base folder is where all profiles, mods, and game files are stored. Changing it moves all your data.",
              "The launcher checks for updates automatically and installs them on the next app restart.",
            ]}
            onDismiss={pageHint.dismiss}
          />
        )}
        
        <div className="settings-section">
          <h3>Storage</h3>
          <div className="settings-item">
            <label>Base Folder</label>
            <div className="settings-value-with-action">
              <div className="settings-value" title={settings.basePath || "Not set"}>
                {settings.basePath || "Not set"}
              </div>
              <button 
                className="btn btn-secondary btn-small"
                onClick={() => setShowConfirmDialog(true)}
                disabled={isChangingFolder}
              >
                {isChangingFolder ? "Changing..." : "Change"}
              </button>
            </div>
            <p className="settings-hint">
              This is where all your profiles, mods, and game data are stored.
            </p>
          </div>
        </div>

        <div className="settings-section">
          <h3>Game</h3>
          <p className="settings-placeholder">Game settings coming soon...</p>
        </div>

        <div className="settings-section">
          <h3>Maintenance</h3>
          <p className="settings-placeholder">Maintenance tools coming soon...</p>
        </div>

        <div className="settings-section">
          <h3>Appearance</h3>
          <div className="settings-item">
            <label>Theme</label>
            <div className="theme-toggle-container">
              <button
                className={`theme-toggle-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => onThemeChange('dark')}
              >
                🌙 Dark
              </button>
              <button
                className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => onThemeChange('light')}
              >
                ☀️ Light
              </button>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>About</h3>
          <div className="settings-item">
            <label>Version</label>
            <div className="settings-value">{appVersion}</div>
          </div>
        </div>
      </div>

      {showConfirmDialog && (
        <div className="modal-overlay" onClick={() => setShowConfirmDialog(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Change Base Folder</h3>
            <p style={{ marginBottom: "16px", color: "#ccc" }}>
              Changing the base folder will point the launcher to a new location.
              Your existing data will remain in the old location.
            </p>
            <p style={{ marginBottom: "16px", color: "#f0a040" }}>
              ⚠️ If you want to keep your profiles and mods, manually copy them from:
            </p>
            <div style={{ 
              background: "rgba(0,0,0,0.3)", 
              padding: "8px 12px", 
              borderRadius: "4px", 
              marginBottom: "16px",
              wordBreak: "break-all",
              fontSize: "12px"
            }}>
              {settings.basePath}
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleChangeFolder}>
                Choose New Folder
              </button>
              <button className="btn btn-cancel" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
