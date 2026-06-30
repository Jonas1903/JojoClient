import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import "./App.css";
import type { Profile, ModIssue, InstallationWithProfile } from "./main/types";
import { IconPlay, IconPackage, IconHandshake, IconUserCircle, IconUser, IconSettings } from "./components/icons";
import type { Settings, AccountData, Account, GameState, Tab, DownloadProgress, ModDownloadProgress } from "./types";
import { PlayScreen } from "./screens/PlayScreen";
import { ProfilesScreen } from "./screens/ProfilesScreen";
import { ModsScreen } from "./screens/ModsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { NewInstallationModal, AccountModal, ProfileModal } from "./components/modals";
type Installation = InstallationWithProfile;
const SHOW_PARTNER_TAB: boolean = import.meta.env.DEV;

// ============================================
// Main App Component
// ============================================

export default function App() {
  const [settings, setSettings] = useState<Settings>({ basePath: null });
  const [account, setAccount] = useState<Account>(null);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("play");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Game state
  const [gameState, setGameState] = useState<GameState>("idle");
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [modDownloadProgress, setModDownloadProgress] = useState<ModDownloadProgress | null>(null);
  const [gameLogs, setGameLogs] = useState<string[]>([]);
  const [launchAnotherBusy, setLaunchAnotherBusy] = useState(false);
  const launchAnotherTimerRef = useRef<number | null>(null);
  // Per-installation ref lock: prevents button-spam sending multiple IPC calls for the
  // same installation before the first one returns. Different installations are independent.
  const launchingInstallationIdsRef = useRef<Set<string>>(new Set());
  // Sync ref for game running state — updated immediately on exit events so
  // handlePlay can read it without waiting for the React state to commit.
  const gameRunningRef = useRef(false);

  // Profiles & Installations
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null);

  const [installationModIssues, setInstallationModIssues] = useState<Record<string, ModIssue[]>>({});
  const [modIssuesModal, setModIssuesModal] = useState<{
    show: boolean;
    installationId: string | null;
    installationName: string;
    issues: ModIssue[];
  }>({ show: false, installationId: null, installationName: "", issues: [] });

  // Modals
  const [showNewInstallationModal, setShowNewInstallationModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ show: false, title: '', message: '', onConfirm: () => {} });

  const [infoModal, setInfoModal] = useState<{ show: boolean; title: string; message: string }>(
    { show: false, title: '', message: '' }
  );

  // Global busy overlay
  const [busyOverlay, setBusyOverlay] = useState<{ show: boolean; message: string }>({ show: false, message: "" });

  // Auto-updater state
  const [updateStatus, setUpdateStatus] = useState<{
    state: "idle" | "available" | "downloading" | "ready";
    version?: string;
    percent?: number;
    error?: string;
  }>({ state: "idle" });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      show: true,
      title,
      message,
      onConfirm: async () => {
        try {
          await onConfirm();
        } finally {
          hideConfirm();
        }
      },
    });
  };

  const hideConfirm = () => {
    setConfirmModal({ show: false, title: '', message: '', onConfirm: () => {} });
  };

  const showInfo = (title: string, message: string) => {
    setInfoModal({ show: true, title, message });
  };

  const hideInfo = () => {
    setInfoModal({ show: false, title: '', message: '' });
  };

  const showBusy = useCallback((message: string) => setBusyOverlay({ show: true, message }), []);
  const hideBusy = useCallback(() => setBusyOverlay({ show: false, message: "" }), []);

  const selectableProfiles = profiles.filter((p) => !p.isDefault);
  const hiddenProfileIds = useMemo(
    () => new Set(profiles.filter((p) => p.isDefault).map((p) => p.id)),
    [profiles]
  );
  const visibleInstallations = useMemo(
    () => installations.filter((inst) => !hiddenProfileIds.has(inst.profileId)),
    [installations, hiddenProfileIds]
  );

  // Load data
  const loadProfiles = useCallback(async () => {
    try {
      const result = await window.jojoclient.getAllProfiles();
      if (result.ok && result.profiles) {
        setProfiles(result.profiles);
      }
    } catch (e) {
      console.error("Failed to load profiles:", e);
    }
  }, []);

  const loadInstallations = useCallback(async () => {
    try {
      const result = await window.jojoclient.getAllInstallations();
      if (result.ok && result.installations) {
        setInstallations(result.installations);
        
        // Load mod issues from installations
        const issuesMap: Record<string, ModIssue[]> = {};
        for (const installation of result.installations) {
          if (installation.modIssues && installation.modIssues.length > 0) {
            issuesMap[installation.id] = installation.modIssues;
          }
        }
        setInstallationModIssues(issuesMap);
      }
    } catch (e) {
      console.error("Failed to load installations:", e);
    }
  }, []);

  const refreshProfilesAndInstallations = useCallback(async () => {
    await loadProfiles();
    await loadInstallations();
  }, [loadProfiles, loadInstallations]);

  const refreshGameStatus = useCallback(async () => {
    try {
      const gameStatus = await window.jojoclient.getGameStatus();
      gameRunningRef.current = gameStatus.isRunning;
      setGameState(gameStatus.isRunning ? "running" : "idle");
    } catch (e) {
      console.error("Failed to refresh game status:", e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!window.jojoclient) {
          throw new Error("window.jojoclient is undefined. Preload bridge is not loaded.");
        }

        const s = await window.jojoclient.getSettings();
        setSettings(s);

        if (s.basePath) {
          const accountsResult = await window.jojoclient.getAccounts();
          if (accountsResult.ok && accountsResult.accounts) {
            setAccounts(accountsResult.accounts);
          }

          const authResult = await window.jojoclient.getAccount();
          if (authResult.ok && authResult.account) {
            const loadedAccount = { username: authResult.account.username, uuid: authResult.account.uuid };
            setAccount(loadedAccount);
          }

          await loadProfiles();
          await loadInstallations();

          await refreshGameStatus();
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();

    const unsubProgress = window.jojoclient?.onDownloadProgress?.((progress) => {
      setDownloadProgress(progress as DownloadProgress);
    });

    const unsubLog = window.jojoclient?.onGameLog?.((line) => {
      setGameLogs((prev) => [...prev.slice(-100), line]);
    });

    const unsubExit = window.jojoclient?.onGameExit?.(() => {
      gameRunningRef.current = false;
      setLaunchAnotherBusy(false);
      refreshGameStatus();
    });

    const unsubModsProgress = window.jojoclient?.onModsDownloadProgress?.((progress) => {
      const payload = progress as ModDownloadProgress;
      if (payload.phase === "done") {
        setModDownloadProgress(null);
        void loadInstallations();
        return;
      }
      setModDownloadProgress(payload);
    });

    const unsubUpdateAvailable = window.jojoclient?.onUpdateAvailable?.((info) => {
      setUpdateStatus({ state: "available", version: info.version });
    });

    const unsubUpdateNotAvailable = window.jojoclient?.onUpdateNotAvailable?.(() => {
      setUpdateStatus({ state: "idle" });
    });

    const unsubUpdateDownloadProgress = window.jojoclient?.onUpdateDownloadProgress?.((progress) => {
      setUpdateStatus({ state: "downloading", percent: progress.percent });
    });

    const unsubUpdateDownloaded = window.jojoclient?.onUpdateDownloaded?.(() => {
      setUpdateStatus({ state: "ready" });
    });

    const unsubUpdateError = window.jojoclient?.onUpdateError?.((msg) => {
      setError(`Update error: ${msg}`);
      setUpdateStatus({ state: "idle" });
    });

    return () => {
      unsubProgress?.();
      unsubLog?.();
      unsubExit?.();
      unsubModsProgress?.();
      unsubUpdateAvailable?.();
      unsubUpdateNotAvailable?.();
      unsubUpdateDownloadProgress?.();
      unsubUpdateDownloaded?.();
      unsubUpdateError?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadProfiles, loadInstallations, refreshGameStatus]);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      if (launchAnotherTimerRef.current) {
        window.clearTimeout(launchAnotherTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (visibleInstallations.length === 0) {
      if (selectedInstallation) setSelectedInstallation(null);
      return;
    }
    if (selectedInstallation && hiddenProfileIds.has(selectedInstallation.profileId)) {
      setSelectedInstallation(visibleInstallations[0] || null);
      return;
    }
    if (!selectedInstallation) {
      setSelectedInstallation(visibleInstallations[0] || null);
    }
  }, [visibleInstallations, hiddenProfileIds, selectedInstallation]);

  const refreshInstallationModIssues = useCallback(async (_profileId: string) => {
    await loadInstallations();
  }, [loadInstallations]);

  useEffect(() => {
    if (!modIssuesModal.show || !modIssuesModal.installationId) return;
    const current = installationModIssues[modIssuesModal.installationId] || [];
    if (current.length === 0) {
      setModIssuesModal({ show: false, installationId: null, installationName: "", issues: [] });
    }
  }, [installationModIssues, modIssuesModal]);

  // ============================================
  // Handlers
  // ============================================

  async function chooseFolder() {
    try {
      setError(null);
      const result = await window.jojoclient.pickBaseFolder();
      if (!result.ok || !result.path) return;

      const res = await window.jojoclient.setBaseFolder(result.path);
      if (!res.ok) throw new Error(res.error ?? "Failed to set base folder");

      const s = await window.jojoclient.getSettings();
      setSettings(s);

      await loadProfiles();
      await loadInstallations();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }

  async function handleLogin() {
    try {
      setError(null);
      setAuthLoading(true);
      const result = await window.jojoclient.login();
      if (!result.ok) throw new Error(result.error ?? "Login failed");
      if (result.account) {
        const newAccount = { username: result.account.username, uuid: result.account.uuid };
        setAccount(newAccount);
        const accountsResult = await window.jojoclient.getAccounts();
        if (accountsResult.ok && accountsResult.accounts) {
          setAccounts(accountsResult.accounts);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await window.jojoclient.logout(account?.uuid);
      const accountsResult = await window.jojoclient.getAccounts();
      if (accountsResult.ok && accountsResult.accounts) {
        setAccounts(accountsResult.accounts);
      }
      const authResult = await window.jojoclient.getAccount();
      if (authResult.ok && authResult.account) {
        setAccount({ username: authResult.account.username, uuid: authResult.account.uuid });
      } else {
        setAccount(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }

  async function handleSelectAccount(acc: AccountData) {
    try {
      const result = await window.jojoclient.setActiveAccount(acc.uuid);
      if (!result.ok) throw new Error(result.error ?? "Failed to switch account");
      const authResult = await window.jojoclient.getAccount();
      if (authResult.ok && authResult.account) {
        setAccount({ username: authResult.account.username, uuid: authResult.account.uuid });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }

  async function handlePlay() {
    if (!selectedInstallation || !account) return;
    if (launchingInstallationIdsRef.current.has(selectedInstallation.id)) return;
    if (gameRunningRef.current && launchAnotherBusy) return;

    launchingInstallationIdsRef.current.add(selectedInstallation.id);
    try {
      setError(null);
      if (!gameRunningRef.current) {
        gameRunningRef.current = true;
        setGameState("downloading");
        setGameLogs([]);
        setDownloadProgress(null);
      } else {
        // Game is already running — launch another instance with cooldown.
        setLaunchAnotherBusy(true);
        if (launchAnotherTimerRef.current) {
          window.clearTimeout(launchAnotherTimerRef.current);
        }
        launchAnotherTimerRef.current = window.setTimeout(() => {
          setLaunchAnotherBusy(false);
          launchAnotherTimerRef.current = null;
        }, 5000);
      }

      const result = await window.jojoclient.launchGame({
        mcVersion: selectedInstallation.minecraftVersion,
        fabricVersion: selectedInstallation.fabricLoaderVersion,
        installationId: selectedInstallation.id,
      });
      if (!result.ok) throw new Error(result.error ?? "Failed to launch game");

      await refreshGameStatus();

      await window.jojoclient.updateInstallation({
        id: selectedInstallation.id,
        updates: { lastPlayedAt: new Date().toISOString() },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      await refreshGameStatus();
    } finally {
      launchingInstallationIdsRef.current.delete(selectedInstallation.id);
    }
  }

  async function handleQuickPlay(mcVersion: string) {
    try {
      setError(null);
      setGameState("downloading");
      setGameLogs([]);
      setDownloadProgress(null);

      if (!window.jojoclient.launchQuickGame) {
        throw new Error("Quick Play API not available. Please restart the app.");
      }

      const result = await window.jojoclient.launchQuickGame({ mcVersion });
      if (!result.ok) throw new Error(result.error ?? "Failed to launch game");
      await refreshGameStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      await refreshGameStatus();
    }
  }

  function handleNewInstallation() {
    if (selectableProfiles.length === 0) {
      showInfo("Profiles", "Please create a profile before creating a new installation.");
      return;
    }
    setShowNewInstallationModal(true);
  }

  async function handleKill() {
    try {
      await window.jojoclient.killGame();
      await refreshGameStatus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }

  async function handleCreateInstallation(profileId: string, name: string, minecraftVersion: string, description: string) {
    showBusy("Creating installation...");
    try {
      const result = await window.jojoclient.createInstallation({ profileId, name, minecraftVersion, description });
      if (!result.ok) throw new Error(result.error);
      setModIssuesModal({ show: false, installationId: null, installationName: "", issues: [] });
      if (result.installation) {
        setSelectedInstallation(result.installation as Installation);
      }
      await loadInstallations();
      setShowNewInstallationModal(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      hideBusy();
    }
  }

  async function handleDeleteInstallation() {
    if (!selectedInstallation) return;
    
    showConfirm(
      'Delete Installation',
      `Are you sure you want to delete "${selectedInstallation.name}"?`,
      async () => {
        try {
          const result = await window.jojoclient.deleteInstallation(selectedInstallation.id);
          if (!result.ok) throw new Error(result.error);
          setSelectedInstallation(null);
          await loadInstallations();
          hideConfirm();
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
          hideConfirm();
        }
      }
    );
  }

  async function handleOpenInstallationMods() {
    if (!selectedInstallation) return;
    try {
      const result = await window.jojoclient.getInstallationGameDir(selectedInstallation.id);
      if (!result.ok || !result.gameDir) {
        throw new Error(result.error ?? "Failed to get installation folder");
      }
      await window.jojoclient.openFolder(`${result.gameDir}/mods`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }

  async function handleOpenInstallationLogs() {
    if (!selectedInstallation) return;
    try {
      const result = await window.jojoclient.getInstallationGameDir(selectedInstallation.id);
      if (!result.ok || !result.gameDir) {
        throw new Error(result.error ?? "Failed to get installation folder");
      }
      await window.jojoclient.openFolder(`${result.gameDir}/logs`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }

  async function handleReloadInstallationMods() {
    if (!selectedInstallation) return;
    try {
      if (!window.jojoclient.syncInstallationMods) {
        showInfo("Mods", "Mod reload API not available. Please restart the app.");
        return;
      }
      setModDownloadProgress({ phase: "start", current: 0, total: 0, installationId: selectedInstallation.id });
      const result = await window.jojoclient.syncInstallationMods(selectedInstallation.id);
      if (!result.ok) throw new Error(result.error || "Mod reload failed");

      await refreshInstallationModIssues(selectedInstallation.profileId);
      showInfo("Mods", "Reload complete.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }

  function handleGoToProfile() {
    if (!selectedInstallation) return;
    const profile = profiles.find(p => p.id === selectedInstallation.profileId);
    if (profile) {
      setEditingProfile(profile);
      setShowProfileModal(true);
    }
  }

  async function handleChangeInstallationProfile(newProfileId: string) {
    if (!selectedInstallation) return;
    try {
      const result = await window.jojoclient.moveInstallation({
        installationId: selectedInstallation.id,
        targetProfileId: newProfileId
      });
      if (result.ok) {
        await loadInstallations();
        // Update selected installation with new profile info
        if (result.installation) {
          setSelectedInstallation(result.installation as Installation);
        }
      }
    } catch (e) {
      console.error("Failed to move installation:", e);
    }
    setShowProfileModal(false);
    setEditingProfile(null);
  }

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return <div className="loading-screen">Loading JojoClient...</div>;
  }

  if (!settings.basePath) {
    return (
      <div className="setup-screen">
        <div className="setup-card">
          <svg width="64" height="64" viewBox="200 40 280 280" aria-hidden="true" className="setup-logo">
            <rect x="200" y="40" width="280" height="280" rx="40" fill="#000"/>
            <polygon points="340,86 373,105 340,124 307,105" fill="#fff"/>
            <polygon points="383,111 416,130 383,149 350,130" fill="#fff"/>
            <polygon points="297,111 330,130 297,149 264,130" fill="#fff"/>
            <polygon points="340,136 373,155 340,174 307,155" fill="#fff"/>
            <polygon points="345,183 378,164 378,202 345,221" fill="#fff"/>
            <polygon points="388,158 421,139 421,177 388,196" fill="#fff"/>
            <polygon points="345,233 378,214 378,252 345,271" fill="#fff"/>
            <polygon points="388,208 421,189 421,227 388,246" fill="#fff"/>
            <polygon points="259,139 292,158 292,196 259,177" fill="#fff"/>
            <polygon points="302,164 335,183 335,221 302,202" fill="#fff"/>
            <polygon points="259,189 292,208 292,246 259,227" fill="#fff"/>
            <polygon points="302,214 335,233 335,271 302,252" fill="#fff"/>
          </svg>
          <h1>JojoClient</h1>
          <p>Choose where JojoClient should store your Minecraft installations, profiles, and mods.</p>
          {error && <div className="error-message" data-testid="setup-error">{error}</div>}
          <button className="btn btn-primary" onClick={chooseFolder} data-testid="choose-folder-btn">
            Choose Folder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Top Navigation Bar */}
      <header className="top-navbar">
        <div className="navbar-drag-region">
          <div className="navbar-brand">
            <svg width="22" height="22" viewBox="200 40 280 280" aria-hidden="true" className="navbar-logo">
              <rect x="200" y="40" width="280" height="280" rx="40" fill="#000"/>
              <polygon points="340,86 373,105 340,124 307,105" fill="#fff"/>
              <polygon points="383,111 416,130 383,149 350,130" fill="#fff"/>
              <polygon points="297,111 330,130 297,149 264,130" fill="#fff"/>
              <polygon points="340,136 373,155 340,174 307,155" fill="#fff"/>
              <polygon points="345,183 378,164 378,202 345,221" fill="#fff"/>
              <polygon points="388,158 421,139 421,177 388,196" fill="#fff"/>
              <polygon points="345,233 378,214 378,252 345,271" fill="#fff"/>
              <polygon points="388,208 421,189 421,227 388,246" fill="#fff"/>
              <polygon points="259,139 292,158 292,196 259,177" fill="#fff"/>
              <polygon points="302,164 335,183 335,221 302,202" fill="#fff"/>
              <polygon points="259,189 292,208 292,246 259,227" fill="#fff"/>
              <polygon points="302,214 335,233 335,271 302,252" fill="#fff"/>
            </svg>
            JojoClient
          </div>
          
          <nav className="navbar-tabs">
            <button
              className={`navbar-tab ${activeTab === "play" ? "active" : ""}`}
              onClick={() => setActiveTab("play")}
              data-testid="nav-play"
            >
              <span className="tab-icon"><IconPlay /></span>
              Play
            </button>
            <button
              className={`navbar-tab ${activeTab === "mods" ? "active" : ""}`}
              onClick={() => setActiveTab("mods")}
              data-testid="nav-mods"
            >
              <span className="tab-icon"><IconPackage /></span>
              Mods
            </button>
            {SHOW_PARTNER_TAB && (
              <button
                className={`navbar-tab ${activeTab === "partner" ? "active" : ""}`}
                onClick={() => setActiveTab("partner")}
                data-testid="nav-partner"
              >
                <span className="tab-icon"><IconHandshake /></span>
                Partner
              </button>
            )}
          </nav>

          <div className="navbar-actions">
            <button
              className={`navbar-account-btn ${!account ? 'no-account' : ''}`}
              onClick={() => setShowAccountModal(true)}
              title="Account"
              data-testid="account-button"
            >
              {account ? (
                <img
                  src={`https://mc-heads.net/avatar/${account.uuid}/32`}
                  alt={account.username}
                  className="account-head"
                />
              ) : (
                <span className="no-account-icon"><IconUserCircle /></span>
              )}
            </button>
            <button
              className={`navbar-icon-btn profiles-btn ${activeTab === "profiles" ? "active" : ""}`}
              onClick={() => setActiveTab("profiles")}
              title="Profiles"
              data-testid="nav-profiles"
            >
              <IconUser />
            </button>
            <button
              className={`navbar-icon-btn ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
              title="Settings"
              data-testid="nav-settings"
            >
              <IconSettings />
            </button>
          </div>
        </div>

        <div className="window-controls">
          <button
            className="window-control-btn minimize"
            onClick={() => window.jojoclient.windowMinimize()}
            title="Minimize"
            data-testid="window-minimize"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1" y="5.5" width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            className="window-control-btn maximize"
            onClick={() => window.jojoclient.windowMaximize()}
            title="Maximize"
            data-testid="window-maximize"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button
            className="window-control-btn close"
            onClick={() => window.jojoclient.windowClose()}
            title="Close"
            data-testid="window-close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" />
              <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </header>

      {/* Update Banner */}
      {updateStatus.state !== "idle" && (
        <div className={`update-banner update-${updateStatus.state === "available" ? "available" : updateStatus.state === "downloading" ? "downloading" : "ready"}`} data-testid="update-banner">
          <span>
            {updateStatus.state === "available" && `Update available${updateStatus.version ? ` (v${updateStatus.version})` : ""}`}
            {updateStatus.state === "downloading" && `Downloading update${updateStatus.percent != null ? ` (${Math.floor(updateStatus.percent)}%)` : "..."}`}
            {updateStatus.state === "ready" && "Update ready — restart to install"}
          </span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {updateStatus.state === "available" && (
              <>
                <button
                  className="update-action-btn"
                  onClick={async () => {
                    const result = await window.jojoclient.downloadUpdate();
                    if (!result.ok) {
                      setUpdateStatus({ state: "available", version: updateStatus.version, error: result.error });
                      return;
                    }
                    // Let the download-progress events transition to "downloading" state
                  }}
                >
                  Download
                </button>
                <button className="update-dismiss-btn" onClick={() => setUpdateStatus({ state: "idle" })}>
                  Dismiss
                </button>
              </>
            )}
            {updateStatus.state === "ready" && (
              <>
                <button className="update-action-btn" onClick={() => window.jojoclient.installUpdate()}>
                  Restart now
                </button>
                <button className="update-dismiss-btn" onClick={() => setUpdateStatus({ state: "idle" })}>
                  Later
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="error-banner" data-testid="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} data-testid="error-dismiss">×</button>
        </div>
      )}

      {/* Main Content */}
      <main className="main-content">
        {activeTab === "play" && (
          <PlayScreen
            account={account}
            profiles={selectableProfiles}
            hasProfiles={selectableProfiles.length > 0}
            installations={visibleInstallations}
            selectedInstallation={selectedInstallation}
            setSelectedInstallation={setSelectedInstallation}
            gameState={gameState}
            downloadProgress={downloadProgress}
            modDownloadProgress={modDownloadProgress}
            gameLogs={gameLogs}
            launchAnotherBusy={launchAnotherBusy}
            installationModIssues={installationModIssues}
            onOpenModIssues={(installationId, installationName, issues) =>
              setModIssuesModal({ show: true, installationId, installationName, issues })
            }
            onPlay={handlePlay}
            onQuickPlay={handleQuickPlay}
            onKill={handleKill}
            onNewInstallation={handleNewInstallation}
            onGoToProfile={handleGoToProfile}
            onDeleteInstallation={handleDeleteInstallation}
            onOpenInstallationMods={handleOpenInstallationMods}
            onOpenInstallationLogs={handleOpenInstallationLogs}
            onReloadInstallationMods={handleReloadInstallationMods}
          />
        )}

        {activeTab === "profiles" && (
          <ProfilesScreen
            profiles={selectableProfiles}
            installations={installations}
            basePath={settings.basePath}
            onRefresh={refreshProfilesAndInstallations}
            onInfo={showInfo}
            onConfirm={showConfirm}
            onReloadInstallations={loadInstallations}
            onRefreshInstallationModIssues={refreshInstallationModIssues}
            onSetInstallationModIssues={setInstallationModIssues}
            onBusy={showBusy}
            onBusyDone={hideBusy}
          />
        )}

        {activeTab === "mods" && (
          <ModsScreen
            profiles={selectableProfiles}
            installations={installations}
            basePath={settings.basePath}
            onRefresh={refreshProfilesAndInstallations}
            onInfo={showInfo}
            onProfileModsChanged={refreshInstallationModIssues}
            modDownloadProgress={modDownloadProgress}
            onBusy={showBusy}
            onBusyDone={hideBusy}
          />
        )}

        {activeTab === "settings" && (
          <SettingsScreen
            settings={settings}
            theme={theme}
            onThemeChange={setTheme}
            onChangeBaseFolder={chooseFolder}
          />
        )}

        {SHOW_PARTNER_TAB && activeTab === "partner" && (
          <div className="coming-soon">
            <div className="coming-soon-icon"><IconHandshake /></div>
            <h2>Partner</h2>
            <p>Partner features coming soon.</p>
          </div>
        )}
      </main>

      {/* Modals */}
      {showNewInstallationModal && (
        <NewInstallationModal
          profiles={selectableProfiles}
          onClose={() => setShowNewInstallationModal(false)}
          onCreate={handleCreateInstallation}
          basePath={settings.basePath}
        />
      )}

      {showAccountModal && (
        <AccountModal
          account={account}
          accounts={accounts}
          authLoading={authLoading}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onSelectAccount={handleSelectAccount}
          onClose={() => setShowAccountModal(false)}
        />
      )}

      {showProfileModal && (
        <ProfileModal
          profiles={selectableProfiles}
          editingProfile={editingProfile}
          onClose={() => {
            setShowProfileModal(false);
            setEditingProfile(null);
          }}
          onSave={handleChangeInstallationProfile}
        />
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="modal-overlay" onClick={hideConfirm} data-testid="confirm-overlay">
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmModal.title}</h3>
            <p className="confirm-message">{confirmModal.message}</p>
            <div className="confirm-actions">
              <button className="btn btn-cancel" onClick={hideConfirm} data-testid="confirm-cancel">
                Cancel
              </button>
              <button className="btn btn-danger" onClick={confirmModal.onConfirm} data-testid="confirm-delete">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {infoModal.show && (
        <div className="modal-overlay" onClick={hideInfo} data-testid="info-overlay">
          <div className="modal info-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{infoModal.title}</h3>
            <p className="info-message">{infoModal.message}</p>
            <div className="confirm-actions">
              <button className="btn btn-cancel" onClick={hideInfo} data-testid="info-ok">
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {modIssuesModal.show && (
        <div className="modal-overlay" onClick={() => setModIssuesModal({ show: false, installationId: null, installationName: "", issues: [] })}>
          <div className="modal info-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Mod Issues</h3>
            <p className="info-message">
              Some mods encountered issues during installation for {modIssuesModal.installationName}.
            </p>
            <div className="mod-issues-list">
              {modIssuesModal.issues.map((issue, idx) => (
                <div key={idx} className="mod-issue-item">
                  <div className="mod-issue-header">
                    <strong>{issue.modName || issue.slug}</strong>
                    <span className="mod-issue-time">{new Date(issue.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="mod-issue-error">{issue.error}</div>
                  {issue.details && (
                    <details className="mod-issue-details">
                      <summary>More details</summary>
                      <pre>{issue.details}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
            <div className="confirm-actions">
              <button className="btn btn-cancel" onClick={() => setModIssuesModal({ show: false, installationId: null, installationName: "", issues: [] })}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Busy Overlay */}
      {busyOverlay.show && (
        <div className="busy-overlay" data-testid="busy-overlay">
          <div className="busy-content">
            <div className="spinner" />
            <span className="busy-message">{busyOverlay.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}


