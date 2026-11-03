import { useEffect, useState } from "react";
import { IconInfo, IconWarning } from "../components/icons";
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
              "Maximum memory is how much RAM Minecraft may use. Large mod setups and shaders need more.",
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
          <GameMemorySetting />
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
                Dark
              </button>
              <button
                className={`theme-toggle-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => onThemeChange('light')}
              >
                Light
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
            <p className="base-folder-confirm-text">
              Changing the base folder will point the launcher to a new location.
              Your existing data will remain in the old location.
            </p>
            <p className="base-folder-confirm-warning">
              <IconWarning />
              If you want to keep your profiles and mods, manually copy them from:
            </p>
            <div className="base-folder-confirm-path">
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

type MemorySettingsResult = Awaited<ReturnType<Window["jojoclient"]["getMemorySettings"]>>;

const MEMORY_OPTION_STEP_MB = 1024;

function buildMemoryOptions(minMb: number, maxAllowedMb: number, extra: number[]): number[] {
  const values = new Set<number>(extra);
  for (let mb = minMb; mb <= maxAllowedMb; mb += MEMORY_OPTION_STEP_MB) values.add(mb);
  return [...values].filter((mb) => mb >= minMb && mb <= maxAllowedMb).sort((a, b) => a - b);
}

function GameMemorySetting() {
  const [memory, setMemory] = useState<MemorySettingsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    window.jojoclient
      .getMemorySettings()
      .then((result) => {
        if (result.ok) setMemory(result);
        else setError(result.error || "Could not read memory settings.");
      })
      .catch(() => setError("Could not read memory settings."));
  }, []);

  if (!memory?.ok || !memory.maxMemoryMb || !memory.minMb || !memory.maxAllowedMb || !memory.totalMb) {
    return error ? <p className="settings-hint settings-hint-error">{error}</p> : null;
  }

  const recommendedMb = memory.recommendedMb ?? memory.maxMemoryMb;
  const options = buildMemoryOptions(memory.minMb, memory.maxAllowedMb, [recommendedMb, memory.maxMemoryMb]);
  const totalGb = Math.round(memory.totalMb / 1024);

  const handleChange = async (value: number) => {
    const previous = memory;
    setMemory({ ...memory, maxMemoryMb: value });
    setError(null);
    setIsSaving(true);
    try {
      const result = await window.jojoclient.setMaxMemory(value);
      if (result.ok) {
        setMemory(result);
      } else {
        setMemory(previous);
        setError(result.error || "Could not save memory setting.");
      }
    } catch {
      setMemory(previous);
      setError("Could not save memory setting.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="settings-item">
      <label htmlFor="settings-max-memory">Maximum Memory</label>
      <select
        id="settings-max-memory"
        className="select settings-memory-select"
        value={memory.maxMemoryMb}
        disabled={isSaving}
        onChange={(e) => handleChange(Number(e.target.value))}
      >
        {options.map((mb) => (
          <option key={mb} value={mb}>
            {mb === recommendedMb ? `${mb} MB (recommended)` : `${mb} MB`}
          </option>
        ))}
      </select>
      <p className="settings-hint">
        Your PC has {totalGb} GB of RAM. Applies the next time you start the game.
      </p>
      {error && <p className="settings-hint settings-hint-error">{error}</p>}
    </div>
  );
}
