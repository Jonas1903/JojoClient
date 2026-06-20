import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile, Mod, ModrinthMod } from "../main/types";
import { IconInfo, IconFolder, IconPackage } from "../components/icons";
import { MC_VERSIONS, usePageHint, PageHintCallout, normalizeText, matchScore } from "../lib/utils";
import type { Installation, ModDownloadProgress } from "../types";

export function ModsScreen({
  profiles,
  installations,
  basePath,
  onRefresh,
  onInfo,
  onProfileModsChanged,
  modDownloadProgress,
  onBusy,
  onBusyDone,
}: {
  profiles: Profile[];
  installations: Installation[];
  basePath: string | null;
  onRefresh: () => void;
  onInfo: (title: string, message: string) => void;
  onProfileModsChanged: (profileId: string) => void;
  modDownloadProgress: ModDownloadProgress | null;
  onBusy: (message: string) => void;
  onBusyDone: () => void;
}) {
  const pageHint = usePageHint("mods");
  const [activeSubTab, setActiveSubTab] = useState<"own" | "search">("own");
  const [selectedProfileId, setSelectedProfileId] = useState(profiles[0]?.id || "");
  const [mods, setMods] = useState<Mod[]>([]);
  const [modIcons, setModIcons] = useState<Record<string, string | null>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ModrinthMod[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedInstallationId, setSelectedInstallationId] = useState<string | null>(null);
  const [selectedModSlug, setSelectedModSlug] = useState<string | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [overlayPosition, setOverlayPosition] = useState<"top" | "bottom">("top");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedModSlugs, setSelectedModSlugs] = useState<string[]>([]);
  const [exportModsModal, setExportModsModal] = useState<{ show: boolean; bundle: string }>({
    show: false,
    bundle: "",
  });
  const [importModsModal, setImportModsModal] = useState<{ show: boolean; code: string }>({
    show: false,
    code: "",
  });

  const searchResultsRef = useRef<HTMLDivElement | null>(null);
  const resultRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastScrollTopRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchCacheRef = useRef<Map<string, ModrinthMod[]>>(new Map());
  
  const selectedProfile = profiles.find(p => p.id === selectedProfileId);
  const profileInstallations = installations.filter(i => i.profileId === selectedProfileId);
  const selectedMod = searchResults.find(m => m.slug === selectedModSlug);

  const progressInstallation = modDownloadProgress?.installationId
    ? installations.find((inst) => inst.id === modDownloadProgress.installationId)
    : null;

  const modProgressLabel = (() => {
    if (!modDownloadProgress) return "";
    if (modDownloadProgress.phase === "start") return "Preparing mod sync...";
    if (modDownloadProgress.phase === "validate") return "Validating mod dependencies...";
    if (modDownloadProgress.phase === "mod") {
      const base = `Downloading mods: ${modDownloadProgress.current}/${modDownloadProgress.total}`;
      return modDownloadProgress.slug ? `${base} (${modDownloadProgress.slug})` : base;
    }
    return "Syncing mods...";
  })();

  const modProgressPercent =
    modDownloadProgress && modDownloadProgress.total > 0 && modDownloadProgress.phase !== "validate"
      ? Math.min(100, Math.max(0, (modDownloadProgress.current / modDownloadProgress.total) * 100))
      : null;

  const selectedModKeys = new Set(selectedModSlugs);

  // Load mods for selected profile
  useEffect(() => {
    if (selectedProfileId) {
      loadMods();
      onProfileModsChanged(selectedProfileId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfileId]);

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
    setSelectionMode(false);
    setSelectedModSlugs([]);
  }, [selectedProfileId]);

  useEffect(() => {
    if (selectedModSlugs.length === 0) return;
    const available = new Set(mods.map((m) => getModKey(m)));
    const filtered = selectedModSlugs.filter((slug) => available.has(slug));
    if (filtered.length !== selectedModSlugs.length) {
      setSelectedModSlugs(filtered);
    }
  }, [mods, selectedModSlugs]);

  useEffect(() => {
    let cancelled = false;

    async function loadIcons() {
      const updates: Record<string, string | null> = {};

      for (const mod of mods) {
        if (mod.iconUrl) {
          if (modIcons[mod.id] !== mod.iconUrl) {
            updates[mod.id] = mod.iconUrl;
          }
          continue;
        }
        if (modIcons[mod.id] !== undefined) continue;

        try {
          const query = mod.slug || mod.name;
          const response = await fetch(
            `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=[["project_type:mod"],["categories:fabric"]]&limit=1`
          );
          const data = await response.json();
          const iconUrl = data?.hits?.[0]?.icon_url ?? null;
          updates[mod.id] = iconUrl;
        } catch {
          updates[mod.id] = null;
        }
      }

      if (!cancelled && Object.keys(updates).length > 0) {
        setModIcons((prev) => ({ ...prev, ...updates }));
      }
    }

    void loadIcons();

    return () => {
      cancelled = true;
    };
  }, [mods, modIcons]);

  async function loadMods() {
    if (!selectedProfileId) return;
    try {
      const result = await window.jojoclient.listProfileMods(selectedProfileId);
      const profileMods = result.ok && result.mods ? (result.mods as Mod[]) : [];
      setMods(profileMods);
    } catch (e) {
      console.error("Failed to load mods:", e);
      setMods([]);
    }
  }

  async function toggleMod(mod: Mod) {
    if (!selectedProfileId) return;
    const nextEnabled = !mod.enabled;
    setMods(mods.map(m =>
      m.id === mod.id ? { ...m, enabled: nextEnabled } : m
    ));

    try {
      if (!window.jojoclient.setProfileModEnabled) {
        throw new Error("Mod toggle API not available. Please restart the app.");
      }
      const slug = mod.slug || mod.id || mod.name;
      const result = await window.jojoclient.setProfileModEnabled({
        profileId: selectedProfileId,
        slug,
        enabled: nextEnabled,
      });
      if (!result.ok) {
        throw new Error(result.error || "Failed to update mod state");
      }
      onProfileModsChanged(selectedProfileId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMods(mods.map(m =>
        m.id === mod.id ? { ...m, enabled: !nextEnabled } : m
      ));
      onInfo("Update failed", msg);
    }
  }

  function getModKey(mod: Mod): string {
    return mod.slug || mod.id || mod.name;
  }

  function toggleModSelection(mod: Mod) {
    const key = getModKey(mod);
    setSelectedModSlugs((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }

  function toggleSelectionMode() {
    setSelectionMode((prev) => {
      if (prev) setSelectedModSlugs([]);
      return !prev;
    });
  }

  function handleSelectAll() {
    if (mods.length === 0) return;
    const allKeys = mods.map((m) => getModKey(m));
    setSelectionMode(true);
    setSelectedModSlugs((prev) => {
      const allSelected = prev.length === allKeys.length && allKeys.every((k) => prev.includes(k));
      return allSelected ? [] : allKeys;
    });
  }

  async function handleExportSelected() {
    if (!selectedProfile) return;
    if (!selectedModSlugs.length) {
      onInfo("Export", "Select at least one mod to export.");
      return;
    }
    if (!window.jojoclient.exportProfileMods) {
      onInfo("Export", "Mod export API not available. Please restart the app.");
      return;
    }
    onBusy("Exporting mods...");
    try {
      const result = await window.jojoclient.exportProfileMods({
        profileId: selectedProfile.id,
        slugs: selectedModSlugs,
      });
      if (!result.ok || !result.bundle) {
        throw new Error(result.error || "Export failed");
      }
      setExportModsModal({ show: true, bundle: result.bundle });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Export", msg);
    } finally {
      onBusyDone();
    }
  }

  async function handleSaveExportToFile() {
    if (!exportModsModal.bundle || !selectedProfile) return;
    try {
      const result = await window.jojoclient.saveExportToFile({
        bundle: exportModsModal.bundle,
        defaultName: `${selectedProfile.name}-mods`,
      });
      if (!result.ok && !result.canceled) {
        onInfo("Export", result.error || "Failed to save file");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Export", msg);
    }
  }

  async function handleCopyExportCode() {
    if (!exportModsModal.bundle) return;
    try {
      await navigator.clipboard.writeText(exportModsModal.bundle);
      onInfo("Export", "Code copied to clipboard.");
    } catch {
      onInfo("Export", "Failed to copy code.");
    }
  }

  async function handleLoadImportFromFile() {
    try {
      const result = await window.jojoclient.loadModsBundleFromFile();
      if (result.ok && result.bundle) {
        setImportModsModal({ show: true, code: result.bundle });
      } else if (!result.canceled && result.error) {
        onInfo("Import", result.error);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Import", msg);
    }
  }

  async function handleImportMods() {
    if (!selectedProfile) return;
    const bundle = importModsModal.code.trim();
    if (!bundle) {
      onInfo("Import", "Paste a code or load a file first.");
      return;
    }
    if (!window.jojoclient.importProfileMods) {
      onInfo("Import", "Mod import API not available. Please restart the app.");
      return;
    }
    onBusy("Importing mods...");
    try {
      const result = await window.jojoclient.importProfileMods({
        profileId: selectedProfile.id,
        bundle,
      });
      if (!result.ok) {
        throw new Error(result.error || "Import failed");
      }
      await loadMods();
      setSelectionMode(false);
      setSelectedModSlugs([]);
      setImportModsModal({ show: false, code: "" });
      onProfileModsChanged(selectedProfile.id);
      onInfo(
        "Import complete",
        `Mods added: ${result.added ?? 0}. Skipped duplicates: ${result.skipped ?? 0}. Settings added: ${
          result.settingsAdded ?? 0
        }. Settings skipped: ${result.settingsSkipped ?? 0}.`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Import", msg);
    } finally {
      onBusyDone();
    }
  }

  const searchModrinth = useCallback(async (query: string) => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return;

    const cacheKey = normalizedQuery;
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached) {
      setSearchResults(cached);
      setSearchSuggestions(cached.slice(0, 6).map((m) => m.title));
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearching(true);
    try {
      const response = await fetch(
        `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=[["project_type:mod"],["categories:fabric"]]&limit=20`,
        { signal: controller.signal }
      );
      const data = await response.json();

      const results = data.hits.map((hit: { slug: string; title: string; description: string; author: string; downloads: number; icon_url: string }) => ({
        slug: hit.slug,
        title: hit.title,
        description: hit.description,
        author: hit.author,
        downloads: hit.downloads,
        icon_url: hit.icon_url,
        versions: []
      }));

      const exactMatches = results.filter(
        (m: ModrinthMod) => normalizeText(m.title) === normalizedQuery
      );
      const others = results.filter(
        (m: ModrinthMod) => normalizeText(m.title) !== normalizedQuery
      );

      exactMatches.sort((a: ModrinthMod, b: ModrinthMod) => b.downloads - a.downloads);
      others.sort((a: ModrinthMod, b: ModrinthMod) => {
        const scoreA = matchScore(a.title, normalizedQuery);
        const scoreB = matchScore(b.title, normalizedQuery);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.downloads - a.downloads;
      });

      const sorted = [...exactMatches, ...others];
      searchCacheRef.current.set(cacheKey, sorted);
      setSearchResults(sorted);
      setSearchSuggestions(sorted.slice(0, 6).map((m: ModrinthMod) => m.title));
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error("Failed to search Modrinth:", e);
      }
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchModrinth(q);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchModrinth]);

  function handleSearchScroll() {
    if (!selectedMod) return;
    const el = searchResultsRef.current;
    if (!el) return;
    const current = el.scrollTop;
    const last = lastScrollTopRef.current;
    if (current > last) {
      setOverlayPosition("top");
    } else if (current < last) {
      setOverlayPosition("bottom");
    }
    lastScrollTopRef.current = current;
  }

  function scrollToSelectedMod() {
    if (!selectedMod) return;
    const el = resultRefs.current.get(selectedMod.slug);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function openModsFolder() {
    if (!basePath || !selectedProfile) return;
    const modsPath = `${basePath}\\profiles\\${selectedProfile.name}\\template\\mods`;
    try {
      await window.jojoclient.openFolder(modsPath);
    } catch (e) {
      console.error("Failed to open folder:", e);
    }
  }

  async function addModToProfile(mod: ModrinthMod) {
    if (!selectedProfile) return;
    onBusy(`Adding "${mod.title}" to profile...`);
    try {
      const result = await window.jojoclient.addProfileMod({
        profileId: selectedProfile.id,
        slug: mod.slug,
        title: mod.title,
        iconUrl: mod.icon_url,
      });
      if (!result.ok) {
        onInfo("Download failed", result.error || "Unknown error");
        return;
      }
      await loadMods();
      onProfileModsChanged(selectedProfile.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Download failed", msg);
    } finally {
      onBusyDone();
    }
  }

  async function deleteModFile(mod: Mod) {
    if (!selectedProfile) return;
    onBusy("Deleting mod...");
    try {
      const result = await window.jojoclient.deleteMod({
        type: "profile",
        profileId: selectedProfile.id,
        slug: mod.slug || mod.name,
      });
      if (!result.ok) {
        onInfo("Delete failed", result.error || "Unknown error");
        return;
      }
      await loadMods();
      onProfileModsChanged(selectedProfile.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Delete failed", msg);
    } finally {
      onBusyDone();
    }
  }

  async function downloadMod(mod: ModrinthMod) {
    if (!selectedProfile) return;
    if (!window.jojoclient.downloadMod) {
      onInfo("Download failed", "Mod download API not available. Please restart the app.");
      return;
    }
    onBusy(`Downloading "${mod.title}"...`);
    try {
      const selectedInstallation = selectedInstallationId
        ? profileInstallations.find((inst) => inst.id === selectedInstallationId)
        : null;
      const target = selectedInstallationId
        ? { type: "installation" as const, installationId: selectedInstallationId }
        : null;

      if (!target) return;

      const result = await window.jojoclient.downloadMod({
        ...target,
        mcVersion: selectedInstallation?.minecraftVersion || MC_VERSIONS[0] || "1.21.4",
        slug: mod.slug,
      });

      if (!result.ok) {
        onInfo("Download failed", result.error || "Unknown error");
        return;
      }

      onInfo("Download complete", `Downloaded "${mod.title}".`);
      await loadMods();
      setSelectedModSlug(null);
      setSearchQuery("");
      setSearchResults([]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onInfo("Download failed", msg);
    } finally {
      onBusyDone();
    }
  }

  function isModInstalled(modSlug: string): boolean {
    return mods.some(m => (m.slug || m.name).toLowerCase() === modSlug.toLowerCase());
  }

  // Suppress unused variable warnings
  void onRefresh;
  void selectedProfile;

  return (
    <div className="mods-screen">
      {/* Left Panel - Profiles */}
      <div className="mods-profile-panel">
        <div className="mods-profile-header">
          <h3>Profile</h3>
          <button className="hint-trigger-btn" onClick={pageHint.show} title="What is this page?">
            <IconInfo />
          </button>
        </div>

        <div className="mods-profile-list">
          {profiles.map(p => (
            <div
              key={p.id}
              className={`mods-profile-item ${selectedProfileId === p.id ? 'selected' : ''}`}
              onClick={() => setSelectedProfileId(p.id)}
            >
              <span className="mods-profile-name">{p.name}</span>
            </div>
          ))}
        </div>

        <button className="new-profile-btn-mods" onClick={() => {
          onInfo("Profiles", "Use the ➕ button in the navbar to create profiles.");
        }}>
          + New Profile
        </button>
      </div>

      {/* Right Panel - Content */}
      <div className="mods-content">
        {pageHint.visible && (
          <PageHintCallout
            text="Search Modrinth to add mods to a profile. Switch to My Mods to manage what's installed."
            items={[
              "Mod dependencies are resolved and downloaded automatically — no manual management needed.",
              "Mods sync to your installation automatically before every launch. Disabled mods are skipped.",
              "Incompatible or missing dependencies are flagged before launch to prevent crashes.",
            ]}
            onDismiss={pageHint.dismiss}
          />
        )}
        {/* Header Bar with profile name and action buttons */}
        <div className="mods-header-bar">
          <h3>{profiles.find(p => p.id === selectedProfileId)?.name || 'Select a Profile'}</h3>
          <div className="mods-header-actions">
            {activeSubTab === 'own' && (
              <button className="open-folder-btn" onClick={openModsFolder}>
                <IconFolder /> Open Mods Folder
              </button>
            )}
            <button
              className="search-library-btn"
              onClick={() => setActiveSubTab(activeSubTab === 'search' ? 'own' : 'search')}
            >
              {activeSubTab === 'search' ? '← Back to Mods' : 'Search Library'}
            </button>
          </div>
        </div>

        {modDownloadProgress && (
          <div className="download-progress mods-download-progress">
            <div className="download-phase">
              {progressInstallation ? `${progressInstallation.name}: ` : ""}
              {modProgressLabel}
            </div>
            <div className={`progress-bar ${modProgressPercent === null ? "indeterminate" : ""}`}>
              <div
                className={`progress-bar-fill ${modProgressPercent === null ? "indeterminate" : ""}`}
                style={modProgressPercent === null ? undefined : { width: `${modProgressPercent}%` }}
              />
            </div>
          </div>
        )}

        {activeSubTab === 'own' ? (
          /* Own Mods Tab */
          <div className="own-mods-content">
            <div className="mods-list">
              {mods.length === 0 ? (
                <div className="no-mods">
                  <p>No mods installed</p>
                  <p className="hint">Use "Search Library" to find and download mods</p>
                </div>
              ) : (
                mods.map(mod => (
                  <div key={mod.id} className={`mod-item ${!mod.enabled ? 'disabled' : ''} ${mod.isBundled ? 'bundled' : ''}`}>
                    {selectionMode && !mod.isBundled && (
                      <label className="mod-select">
                        <input
                          type="checkbox"
                          checked={selectedModKeys.has(getModKey(mod))}
                          onChange={() => toggleModSelection(mod)}
                        />
                      </label>
                    )}
                    <div className="mod-icon-small">
                      {mod.isBundled ? (
                        <span>⚡</span>
                      ) : modIcons[mod.id] ? (
                        <img src={modIcons[mod.id] as string} alt={mod.name} />
                      ) : (
                        <span style={{ opacity: 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconPackage /></span>
                      )}
                    </div>
                    <div className="mod-item-info">
                      <span className="mod-name">{mod.name}</span>
                      {mod.isBundled && <span className="bundled-badge">Built-in</span>}
                    </div>
                    {mod.isBundled ? (
                      <span className="mod-bundled-hint">Configure in Profile tab</span>
                    ) : (
                      <button
                        className="mod-delete-btn"
                        onClick={() => deleteModFile(mod)}
                      >
                        Delete
                      </button>
                    )}
                    <label className="mod-toggle">
                      <input
                        type="checkbox"
                        checked={mod.enabled}
                        onChange={() => toggleMod(mod)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Action Buttons */}
            <div className="mods-bottom-actions">
              <button className="mods-action-btn" onClick={toggleSelectionMode}>
                {selectionMode ? "Cancel Selection" : "Select"}
              </button>
              <button className="mods-action-btn" onClick={handleSelectAll}>
                Select All
              </button>
              <button
                className="mods-action-btn"
                onClick={handleExportSelected}
                disabled={!selectedModSlugs.length}
              >
                Export Selected ({selectedModSlugs.length})
              </button>
              <button
                className="mods-action-btn"
                onClick={() => setImportModsModal({ show: true, code: "" })}
              >
                Import
              </button>
            </div>
          </div>
        ) : (
          /* Search Library Tab */
          <div className="search-library-content">
            <div className="search-header">
              <input
                type="text"
                placeholder="Search Modrinth for mods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchModrinth(searchQuery)}
              />
              <button 
                className="btn btn-primary search-btn"
                onClick={() => searchModrinth(searchQuery)}
                disabled={searching}
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchSuggestions.length > 0 && (
              <div className="search-suggestions">
                {searchSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    className="search-suggestion"
                    onClick={() => setSearchQuery(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <div className="search-layout">
              {/* Search Results */}
              <div className="search-results" ref={searchResultsRef} onScroll={handleSearchScroll}>
                <h4>Results:</h4>
                {searchResults.length === 0 ? (
                  <div className="no-results">
                    <p>Search for mods to get started</p>
                  </div>
                ) : (
                  searchResults.map(mod => (
                    <div 
                      key={mod.slug} 
                      className={`search-result-item ${selectedModSlug === mod.slug ? 'selected' : ''} ${isModInstalled(mod.slug) ? 'installed' : ''}`}
                      ref={(el) => {
                        if (el) {
                          resultRefs.current.set(mod.slug, el);
                        } else {
                          resultRefs.current.delete(mod.slug);
                        }
                      }}
                      onClick={() => setSelectedModSlug(selectedModSlug === mod.slug ? null : mod.slug)}
                    >
                      <div className="mod-icon">
                        {mod.icon_url ? (
                          <img src={mod.icon_url} alt={mod.title} />
                        ) : (
                          <span style={{ opacity: 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconPackage /></span>
                        )}
                      </div>
                      <div className="mod-details">
                        <div className="mod-title">{mod.title}</div>
                        <div className="mod-author">by {mod.author}</div>
                        <div className="mod-downloads">{mod.downloads.toLocaleString()} downloads</div>
                      </div>
                      <div className="mod-status">
                        {isModInstalled(mod.slug) && <span className="installed-badge">✓ Installed</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Right Side - Selected Mod & Installations */}
              <div className={`mod-add-panel ${overlayPosition === "top" ? "sticky-top" : "sticky-bottom"}`}>
                {selectedMod ? (
                  <>
                    <div className="selected-mod-info">
                      <h4>{selectedMod.title}</h4>
                      <p className="mod-description">{selectedMod.description}</p>
                    </div>

                    <button className="back-to-result-btn" onClick={scrollToSelectedMod}>
                      Back to result
                    </button>
                    
                    <div className="add-to-section">
                      <button 
                        className="btn btn-primary add-to-profile-btn"
                        onClick={() => addModToProfile(selectedMod)}
                        disabled={isModInstalled(selectedMod.slug)}
                      >
                        {isModInstalled(selectedMod.slug) ? '✓ In Profile' : 'Add to Profile'}
                      </button>
                    </div>

                    <div className="add-to-installations">
                      <h5>Or add to specific installation:</h5>
                      <div className="installation-list-mods">
                        {profileInstallations.length === 0 ? (
                          <p className="no-installations">No installations for this profile</p>
                        ) : (
                          profileInstallations.map(inst => (
                            <div 
                              key={inst.id}
                              className={`installation-select-item ${selectedInstallationId === inst.id ? 'selected' : ''}`}
                              onClick={() => setSelectedInstallationId(inst.id === selectedInstallationId ? null : inst.id)}
                            >
                              <span className="inst-name">{inst.name}</span>
                              <span className="inst-version">{inst.minecraftVersion}</span>
                            </div>
                          ))
                        )}
                      </div>
                      {selectedInstallationId && (
                        <button 
                          className="btn btn-secondary add-to-inst-btn"
                          onClick={() => downloadMod(selectedMod)}
                        >
                          Add to Installation
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="no-mod-selected">
                    <p>Select a mod from the search results</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {exportModsModal.show && (
        <div className="modal-overlay" onClick={() => setExportModsModal({ show: false, bundle: "" })}>
          <div className="modal mods-share-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Export Mods</h3>
            <p className="mods-share-hint">
              Share this code with another user to import your selected mods and settings.
            </p>
            <textarea
              className="mods-share-textarea"
              readOnly
              value={exportModsModal.bundle}
            />
            <div className="mods-share-actions">
              <button className="btn btn-secondary" onClick={handleCopyExportCode}>
                Copy Code
              </button>
              <button className="btn btn-secondary" onClick={handleSaveExportToFile}>
                Save File
              </button>
              <button
                className="btn btn-cancel"
                onClick={() => setExportModsModal({ show: false, bundle: "" })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {importModsModal.show && (
        <div className="modal-overlay" onClick={() => setImportModsModal({ show: false, code: "" })}>
          <div className="modal mods-share-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import Mods</h3>
            <p className="mods-share-hint">
              Paste a mod bundle code or load a file to import mods and settings.
            </p>
            <textarea
              className="mods-share-textarea"
              value={importModsModal.code}
              onChange={(e) => setImportModsModal({ show: true, code: e.target.value })}
              placeholder="Paste mod bundle code here..."
            />
            <div className="mods-share-actions">
              <button className="btn btn-secondary" onClick={handleLoadImportFromFile}>
                Load File
              </button>
              <button className="btn btn-primary" onClick={handleImportMods}>
                Import
              </button>
              <button
                className="btn btn-cancel"
                onClick={() => setImportModsModal({ show: false, code: "" })}
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
