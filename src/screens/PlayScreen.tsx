import { useState } from "react";
import type { Profile, ModIssue } from "../main/types";
import {
  IconInfo,
  IconUser,
  IconFolder,
  IconRefresh,
  IconLog,
  IconTrash,
  IconWarning,
} from "../components/icons";
import { MC_VERSIONS, usePageHint, PageHintCallout } from "../lib/utils";
import type {
  Account,
  Installation,
  GameState,
  DownloadProgress,
  ModDownloadProgress,
} from "../types";

export function PlayScreen({
  account,
  profiles,
  hasProfiles,
  installations,
  selectedInstallation,
  setSelectedInstallation,
  gameState,
  downloadProgress,
  modDownloadProgress,
  gameLogs,
  launchAnotherBusy,
  installationModIssues,
  onOpenModIssues,
  onPlay,
  onQuickPlay,
  onKill,
  onNewInstallation,
  onGoToProfile,
  onDeleteInstallation,
  onOpenInstallationMods,
  onOpenInstallationLogs,
  onReloadInstallationMods,
}: {
  account: Account;
  profiles: Profile[];
  hasProfiles: boolean;
  installations: Installation[];
  selectedInstallation: Installation | null;
  setSelectedInstallation: (i: Installation | null) => void;
  gameState: GameState;
  downloadProgress: DownloadProgress | null;
  modDownloadProgress: ModDownloadProgress | null;
  gameLogs: string[];
  launchAnotherBusy: boolean;
  installationModIssues: Record<string, ModIssue[]>;
  onOpenModIssues: (installationId: string, installationName: string, issues: ModIssue[]) => void;
  onPlay: () => void;
  onQuickPlay: (mcVersion: string) => void;
  onKill: () => void;
  onNewInstallation: () => void;
  onGoToProfile: () => void;
  onDeleteInstallation: () => void;
  onOpenInstallationMods: () => void;
  onOpenInstallationLogs: () => void;
  onReloadInstallationMods: () => void;
}) {
  const pageHint = usePageHint("play");
  const [quickPlayVersion, setQuickPlayVersion] = useState(MC_VERSIONS[0] || "");

  const selectedProfileName = selectedInstallation
    ? selectedInstallation.profileName || profiles.find(p => p.id === selectedInstallation.profileId)?.name || "Profile"
    : "";

  const failedModsForSelected = selectedInstallation
    ? installationModIssues[selectedInstallation.id] || selectedInstallation.modIssues || []
    : [];

  const progressForSelectedInstallation =
    selectedInstallation && modDownloadProgress
      ? !modDownloadProgress.installationId || modDownloadProgress.installationId === selectedInstallation.id
        ? modDownloadProgress
        : null
      : null;

  const selectedModProgressLabel = (() => {
    if (!progressForSelectedInstallation) return "";
    if (progressForSelectedInstallation.phase === "start") return "Preparing mod sync...";
    if (progressForSelectedInstallation.phase === "validate") return "Validating mod dependencies...";
    if (progressForSelectedInstallation.phase === "mod") {
      const base =
        progressForSelectedInstallation.total > 0
          ? `Downloading mods: ${progressForSelectedInstallation.current}/${progressForSelectedInstallation.total}`
          : "Downloading mods...";
      return progressForSelectedInstallation.slug
        ? `${base} (${progressForSelectedInstallation.slug})`
        : base;
    }
    return "Syncing mods...";
  })();

  const selectedModProgressPercent =
    progressForSelectedInstallation && progressForSelectedInstallation.total > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (progressForSelectedInstallation.current / progressForSelectedInstallation.total) * 100
          )
        )
      : null;

  const hasIncompatibleMods = gameLogs.some((line) => line.includes("Incompatible mods"));
  const missingResourceLoader = gameLogs.some((line) => line.includes("fabric-resource-loader-v1"));

  return (
    <div className="play-screen">
      {/* Left Panel - Installations List */}
      <div className="installations-panel">
        <div className="installations-header">
          <h3>Installations</h3>
          <button className="hint-trigger-btn" onClick={pageHint.show} title="What is this page?">
            <IconInfo />
          </button>
        </div>

        <div className="installations-list">
          {installations.map((inst) => (
            <div
              key={inst.id}
              className={`installation-item ${selectedInstallation?.id === inst.id ? "selected" : ""}`}
              onClick={() => setSelectedInstallation(inst)}
            >
              <span className="installation-name">{inst.name}</span>
              <span className="installation-version">MC {inst.minecraftVersion}</span>
            </div>
          ))}
        </div>

        {/* New Installation Button - Sticky Bottom */}
        <button className="new-installation-btn" onClick={onNewInstallation}>
          + New Installation
        </button>
      </div>

      {/* Right Panel - Play Area */}
      <div className="play-area">
        {pageHint.visible && (
          <PageHintCallout
            text="Select an installation on the left and click Play to launch Minecraft."
            items={[
              "Before launch, mods are synced, Java is detected, and the game folder is configured automatically.",
              "If Minecraft crashes within 90 seconds of launch, the launcher retries automatically up to 2 times.",
              "Use + New Installation to create independent game instances within the same profile.",
              "v1.2.3 — If you see this, silent auto-update is working.",
            ]}
            onDismiss={pageHint.dismiss}
          />
        )}
        {selectedInstallation ? (
          <>
            <div className="play-info">
              {!account ? (
                <div className="login-prompt">
                  <p>Please log in to play</p>
                </div>
              ) : (
                <div className="play-controls">
                  {downloadProgress && gameState === "downloading" && (
                    <div className="download-progress">
                      <div className="download-phase">
                        {downloadProgress.phase === "preparing" && "Preparing..."}
                        {downloadProgress.phase === "libraries" &&
                          `Downloading libraries: ${downloadProgress.current}/${downloadProgress.total}`}
                        {downloadProgress.phase === "assets" &&
                          `Downloading assets: ${downloadProgress.current}/${downloadProgress.total}`}
                        {downloadProgress.phase === "client" && "Downloading client..."}
                        {downloadProgress.phase === "done" && "Done!"}
                      </div>
                      {downloadProgress.total > 0 && (
                        <div className="progress-bar">
                          <div
                            className="progress-bar-fill"
                            style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="version-display">
                    <span className="version-label">Version</span>
                    <span className="version-value">
                      MC {selectedInstallation.minecraftVersion} + Fabric {selectedInstallation.fabricLoaderVersion}
                    </span>
                  </div>

                  {gameState === "idle" && (
                    <button className="play-button" onClick={onPlay}>
                      Play
                    </button>
                  )}

                  {gameState === "downloading" && (
                    <button className="play-button downloading" disabled>
                      Downloading...
                    </button>
                  )}

                  {gameState === "running" && (
                    <div className="running-controls">
                      <button
                        className="play-button launch-another"
                        onClick={onPlay}
                        disabled={launchAnotherBusy}
                      >
                        {launchAnotherBusy ? "Launching..." : "Launch Another"}
                      </button>
                      <button className="kill-button" onClick={onKill}>
                        Stop All
                      </button>
                    </div>
                  )}

                  {progressForSelectedInstallation && (
                    <div className="download-progress mod-download-progress">
                      <div className="download-phase">{selectedModProgressLabel}</div>
                      <div
                        className={`progress-bar ${
                          selectedModProgressPercent === null ? "indeterminate" : ""
                        }`}
                      >
                        <div
                          className={`progress-bar-fill ${
                            selectedModProgressPercent === null ? "indeterminate" : ""
                          }`}
                          style={
                            selectedModProgressPercent === null
                              ? undefined
                              : { width: `${selectedModProgressPercent}%` }
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {hasIncompatibleMods && (
              <div className="mod-error-banner">
                <strong>Mod compatibility issue detected.</strong>
                <p>Some mods are incompatible or missing dependencies.</p>
                {missingResourceLoader && (
                  <p>Missing dependency: fabric-resource-loader-v1. Install it or remove the dependent mod.</p>
                )}
              </div>
            )}

            {/* Game Logs */}
            {gameLogs.length > 0 && (
              <div className="game-logs">
                {gameLogs.map((line, i) => (
                  <div
                    key={i}
                    className={`log-line ${line.includes("ERROR") || line.includes("Exception") ? "error" : ""}`}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Actions - Profile left, Delete right */}
            <div className="play-area-actions">
              <div className="play-actions-left">
                <button
                  className="btn btn-secondary"
                  onClick={onGoToProfile}
                >
                  <IconUser /> {selectedProfileName}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={onOpenInstallationMods}
                >
                  <IconFolder /> Mods Folder
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={onReloadInstallationMods}
                >
                  <IconRefresh /> Reload Mods
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={onOpenInstallationLogs}
                >
                  <IconLog /> Logs
                </button>
                {failedModsForSelected.length > 0 && (
                  <button
                    className="btn btn-danger"
                    onClick={() =>
                      onOpenModIssues(
                        selectedInstallation?.id || "",
                        selectedInstallation?.name || "Installation",
                        failedModsForSelected
                      )
                    }
                  >
                    <IconWarning /> Mod Issues ({failedModsForSelected.length})
                  </button>
                )}
              </div>
              <button
                className="btn btn-danger"
                onClick={onDeleteInstallation}
              >
                <IconTrash /> Delete
              </button>
            </div>
          </>
        ) : (
          <div className="no-selection">
            {!hasProfiles ? (
              <div className="quick-play">
                <p>No profiles found. You can Quick Play without a profile.</p>
                <div className="form-group quick-play-version">
                  <label>Version:</label>
                  <select
                    value={quickPlayVersion}
                    onChange={(e) => setQuickPlayVersion(e.target.value)}
                  >
                    {MC_VERSIONS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                {!account ? (
                  <p>Please log in to play</p>
                ) : (
                  <div className="play-controls">
                    {downloadProgress && gameState === "downloading" && (
                      <div className="download-progress">
                        <div className="download-phase">
                          {downloadProgress.phase === "preparing" && "Preparing..."}
                          {downloadProgress.phase === "libraries" &&
                            `Downloading libraries: ${downloadProgress.current}/${downloadProgress.total}`}
                          {downloadProgress.phase === "assets" &&
                            `Downloading assets: ${downloadProgress.current}/${downloadProgress.total}`}
                          {downloadProgress.phase === "client" && "Downloading client..."}
                          {downloadProgress.phase === "done" && "Done!"}
                        </div>
                        {downloadProgress.total > 0 && (
                          <div className="progress-bar">
                            <div
                              className="progress-bar-fill"
                              style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {gameState === "idle" && (
                      <button className="play-button" onClick={() => onQuickPlay(quickPlayVersion)}>
                        Quick Play
                      </button>
                    )}

                    {gameState === "downloading" && (
                      <button className="play-button downloading" disabled>
                        Downloading...
                      </button>
                    )}

                    {gameState === "running" && (
                      <div className="running-controls">
                        <button
                          className="play-button launch-another"
                          onClick={() => onQuickPlay(quickPlayVersion)}
                          disabled={launchAnotherBusy}
                        >
                          {launchAnotherBusy ? "Launching..." : "Launch Another"}
                        </button>
                        <button className="kill-button" onClick={onKill}>
                          Stop All
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p>Select an installation to play</p>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
