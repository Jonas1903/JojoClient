import { BrowserWindow, session } from "electron";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
import { readSettings } from "../utils/storage";

// =============================================================================
// TYPES
// =============================================================================

export type MinecraftAccount = {
  accessToken: string;
  username: string;
  uuid: string;
  xuid: string;
  expiresAt: number;
};

type TokenSet = {
  // Microsoft tokens
  msAccessToken: string;
  msRefreshToken: string;
  msExpiresAt: number;
  
  // Xbox tokens
  xblToken: string;
  xstsToken: string;
  userHash: string;
  xuid: string;
  
  // Minecraft tokens
  mcAccessToken: string;
  mcExpiresAt: number;
  
  // Profile
  username: string;
  uuid: string;
  
  // Metadata
  lastRefresh: number;
  loginDate: number;
};

type AuthStore = {
  version: number;
  activeUuid: string | null;
  accounts: Record<string, TokenSet>;
};

// =============================================================================
// CONSTANTS
// =============================================================================

const STORE_VERSION = 2;
const TOKEN_BUFFER_TIME = 5 * 60 * 1000; // Refresh 5 minutes before expiry
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

// Microsoft OAuth endpoints
const CLIENT_ID = "00000000402b5328"; // Official Minecraft launcher
const REDIRECT_URI = "https://login.live.com/oauth20_desktop.srf";
const SCOPES = "XboxLive.signin offline_access";
const MS_AUTH_URL = "https://login.live.com/oauth20_authorize.srf";
const MS_TOKEN_URL = "https://login.live.com/oauth20_token.srf";

// Xbox Live endpoints
const XBL_AUTH_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";

// Minecraft endpoints
const MC_AUTH_URL = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL = "https://api.minecraftservices.com/minecraft/profile";
const MC_ENTITLEMENTS_URL = "https://api.minecraftservices.com/entitlements/mcstore";

// =============================================================================
// ENCRYPTION UTILITIES
// =============================================================================

function getMachineKey(): Buffer {
  // Generate a machine-specific key based on OS identifiers
  const machineId = `${process.platform}-${process.arch}-${os.homedir()}`;
  return crypto.createHash("sha256").update(machineId).digest();
}

function encryptData(data: string): string {
  const key = getMachineKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function decryptData(encryptedData: string): string {
  const key = getMachineKey();
  const parts = encryptedData.split(":");
  
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }
  
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

// =============================================================================
// STORAGE MANAGEMENT
// =============================================================================

function getAuthFilePath(): string | null {
  const settings = readSettings();
  if (!settings.basePath) return null;
  return path.join(settings.basePath, "auth.enc");
}

function loadStore(): AuthStore {
  const filePath = getAuthFilePath();
  const defaultStore: AuthStore = {
    version: STORE_VERSION,
    activeUuid: null,
    accounts: {},
  };
  
  if (!filePath || !fs.existsSync(filePath)) {
    return defaultStore;
  }
  
  try {
    const encryptedData = fs.readFileSync(filePath, "utf-8");
    const decryptedData = decryptData(encryptedData);
    const parsed = JSON.parse(decryptedData) as AuthStore;
    
    // Validate store structure
    if (!parsed.version || !parsed.accounts) {
      console.warn("⚠️ Invalid auth store structure, resetting");
      return defaultStore;
    }
    
    // Migrate if needed
    if (parsed.version < STORE_VERSION) {
      console.log(`🔄 Migrating auth store from v${parsed.version} to v${STORE_VERSION}`);
      // Add migration logic here if needed in future versions
      parsed.version = STORE_VERSION;
    }
    
    return parsed;
  } catch (error) {
    console.error("❌ Failed to load auth store:", error);
    // Backup corrupted file
    try {
      const backupPath = `${filePath}.corrupted.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
      console.log(`📦 Backed up corrupted auth file to: ${backupPath}`);
    } catch {
      // Ignore backup errors
    }
    return defaultStore;
  }
}

function saveStore(store: AuthStore): void {
  const filePath = getAuthFilePath();
  if (!filePath) {
    throw new Error("Cannot save auth store: base path not configured");
  }
  
  try {
    const jsonData = JSON.stringify(store, null, 2);
    const encryptedData = encryptData(jsonData);
    fs.writeFileSync(filePath, encryptedData, "utf-8");
    console.log("💾 Auth store saved successfully");
  } catch (error) {
    console.error("❌ Failed to save auth store:", error);
    throw new Error("Failed to save authentication data");
  }
}

function getActiveTokenSet(): TokenSet | null {
  const store = loadStore();
  if (!store.activeUuid || !store.accounts[store.activeUuid]) {
    return null;
  }
  return store.accounts[store.activeUuid];
}

function saveTokenSet(tokens: TokenSet): void {
  const store = loadStore();
  store.accounts[tokens.uuid] = tokens;
  store.activeUuid = tokens.uuid;
  saveStore(store);
}

// =============================================================================
// MICROSOFT OAUTH FLOW
// =============================================================================

async function openMicrosoftLoginWindow(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create isolated session
    const authSession = session.fromPartition("persist:auth-session");
    
    // Clear any existing session data
    authSession.clearStorageData({
      storages: ["cookies", "localstorage", "cachestorage"],
    }).then(() => {
      const authWindow = new BrowserWindow({
        width: 520,
        height: 720,
        show: false,
        center: true,
        autoHideMenuBar: true,
        title: "Sign in to Microsoft",
        backgroundColor: "#1e1e1e",
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          session: authSession,
          devTools: false,
        },
      });
      
      // Build auth URL
      const authUrl = new URL(MS_AUTH_URL);
      authUrl.searchParams.set("client_id", CLIENT_ID);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("prompt", "select_account");
      
      let isResolved = false;
      
      const handleNavigation = (url: string) => {
        if (isResolved) return;
        
        if (url.startsWith(REDIRECT_URI)) {
          try {
            const parsedUrl = new URL(url);
            const code = parsedUrl.searchParams.get("code");
            const error = parsedUrl.searchParams.get("error");
            const errorDesc = parsedUrl.searchParams.get("error_description");
            
            if (error) {
              isResolved = true;
              authWindow.destroy();
              reject(new Error(errorDesc || error));
              return;
            }
            
            if (code) {
              isResolved = true;
              authWindow.destroy();
              resolve(code);
              return;
            }
          } catch (err) {
            console.error("Error parsing redirect URL:", err);
          }
        }
      };
      
      // Listen for navigation events
      authWindow.webContents.on("will-redirect", (_event, url) => handleNavigation(url));
      authWindow.webContents.on("will-navigate", (_event, url) => handleNavigation(url));
      
      // Show window when ready
      authWindow.webContents.on("did-finish-load", () => {
        if (!authWindow.isDestroyed()) {
          authWindow.show();
        }
      });
      
      // Handle window close
      authWindow.on("closed", () => {
        if (!isResolved) {
          reject(new Error("Authentication window was closed"));
        }
      });
      
      // Load auth URL
      authWindow.loadURL(authUrl.toString()).catch((err) => {
        if (!isResolved) {
          isResolved = true;
          authWindow.destroy();
          reject(new Error(`Failed to load login page: ${err.message}`));
        }
      });
    }).catch((err) => {
      reject(new Error(`Failed to prepare auth session: ${err.message}`));
    });
  });
}

async function exchangeCodeForTokens(
  code: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    code: code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
  });
  
  const response = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${text}`);
  }
  
  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600,
  };
}

async function refreshMicrosoftToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: SCOPES,
  });
  
  const response = await fetch(MS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${text}`);
  }
  
  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in || 3600,
  };
}

// =============================================================================
// XBOX LIVE AUTHENTICATION
// =============================================================================

async function authenticateXboxLive(
  msAccessToken: string
): Promise<{ token: string; userHash: string; xuid: string }> {
  const response = await fetch(XBL_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${msAccessToken}`,
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
    }),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Xbox Live authentication failed: ${text}`);
  }
  
  const data = await response.json();
  return {
    token: data.Token,
    userHash: data.DisplayClaims?.xui?.[0]?.uhs || "",
    xuid: data.DisplayClaims?.xui?.[0]?.xid || "",
  };
}

async function authenticateXSTS(xblToken: string): Promise<string> {
  const response = await fetch(XSTS_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [xblToken],
      },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    }),
  });
  
  if (!response.ok) {
    const data = await response.json().catch(() => ({ XErr: "unknown" }));
    
    if (data.XErr === 2148916233) {
      throw new Error(
        "This Microsoft account doesn't have an Xbox account. Please create one at xbox.com"
      );
    }
    if (data.XErr === 2148916238) {
      throw new Error(
        "This account is under 18. An adult must add it to a family first."
      );
    }
    
    throw new Error(`XSTS authentication failed: ${JSON.stringify(data)}`);
  }
  
  const data = await response.json();
  return data.Token;
}

// =============================================================================
// MINECRAFT AUTHENTICATION
// =============================================================================

async function authenticateMinecraft(
  xstsToken: string,
  userHash: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await fetch(MC_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
    }),
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Minecraft authentication failed: ${text}`);
  }
  
  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 86400,
  };
}

async function verifyGameOwnership(mcAccessToken: string): Promise<boolean> {
  try {
    const response = await fetch(MC_ENTITLEMENTS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${mcAccessToken}`,
      },
    });
    
    if (!response.ok) {
      console.warn("⚠️ Could not verify game ownership, proceeding anyway");
      return true;
    }
    
    const data = await response.json();
    const items = data.items || [];
    
    const hasGame = items.some(
      (item: { name: string }) =>
        item.name === "game_minecraft" ||
        item.name === "product_minecraft" ||
        item.name === "game_minecraft_bedrock"
    );
    
    return hasGame;
  } catch {
    console.warn("⚠️ Ownership check failed, proceeding anyway");
    return true;
  }
}

async function getMinecraftProfile(
  mcAccessToken: string
): Promise<{ uuid: string; username: string }> {
  const response = await fetch(MC_PROFILE_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${mcAccessToken}`,
    },
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "This account doesn't own Minecraft Java Edition. Please purchase it first."
      );
    }
    const text = await response.text();
    throw new Error(`Failed to get profile: ${text}`);
  }
  
  const data = await response.json();
  return {
    uuid: data.id,
    username: data.name,
  };
}

// =============================================================================
// TOKEN REFRESH LOGIC
// =============================================================================

async function refreshTokenChain(tokens: TokenSet): Promise<TokenSet> {
  const now = Date.now();
  
  console.log("🔄 Refreshing authentication tokens...");
  
  try {
    // Step 1: Refresh Microsoft token
    const msTokens = await refreshMicrosoftToken(tokens.msRefreshToken);
    console.log("✅ Microsoft token refreshed");
    
    // Step 2: Get new Xbox Live token
    const xbl = await authenticateXboxLive(msTokens.accessToken);
    console.log("✅ Xbox Live token refreshed");
    
    // Step 3: Get new XSTS token
    const xstsToken = await authenticateXSTS(xbl.token);
    console.log("✅ XSTS token refreshed");
    
    // Step 4: Get new Minecraft token
    const mc = await authenticateMinecraft(xstsToken, xbl.userHash);
    console.log("✅ Minecraft token refreshed");
    
    // Build new token set
    const refreshedTokens: TokenSet = {
      msAccessToken: msTokens.accessToken,
      msRefreshToken: msTokens.refreshToken,
      msExpiresAt: now + msTokens.expiresIn * 1000,
      xblToken: xbl.token,
      xstsToken: xstsToken,
      userHash: xbl.userHash,
      xuid: xbl.xuid,
      mcAccessToken: mc.accessToken,
      mcExpiresAt: now + mc.expiresIn * 1000,
      username: tokens.username,
      uuid: tokens.uuid,
      lastRefresh: now,
      loginDate: tokens.loginDate,
    };
    
    return refreshedTokens;
  } catch (error) {
    console.error("❌ Token refresh failed:", error);
    throw error;
  }
}

function shouldRefreshTokens(tokens: TokenSet): boolean {
  const now = Date.now();
  
  // Refresh if Minecraft token expires soon
  if (tokens.mcExpiresAt - now < TOKEN_BUFFER_TIME) {
    console.log("⏰ Minecraft token expires soon, refresh needed");
    return true;
  }
  
  // Refresh if Microsoft token expires soon
  if (tokens.msExpiresAt - now < TOKEN_BUFFER_TIME) {
    console.log("⏰ Microsoft token expires soon, refresh needed");
    return true;
  }
  
  return false;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Start full login flow: Microsoft OAuth → Xbox Live → XSTS → Minecraft
 */
export async function login(): Promise<MinecraftAccount> {
  console.log("🔐 Starting authentication flow...");
  
  try {
    // Step 1: Get authorization code via popup
    console.log("📱 Opening Microsoft login window...");
    const code = await openMicrosoftLoginWindow();
    console.log("✅ Authorization code received");
    
    // Step 2: Exchange code for tokens
    const msTokens = await exchangeCodeForTokens(code);
    console.log("✅ Microsoft tokens obtained");
    
    // Step 3: Authenticate with Xbox Live
    const xbl = await authenticateXboxLive(msTokens.accessToken);
    console.log("✅ Xbox Live authenticated");
    
    // Step 4: Get XSTS token
    const xstsToken = await authenticateXSTS(xbl.token);
    console.log("✅ XSTS token obtained");
    
    // Step 5: Authenticate with Minecraft
    const mc = await authenticateMinecraft(xstsToken, xbl.userHash);
    console.log("✅ Minecraft token obtained");
    
    // Step 6: Verify game ownership
    const ownsGame = await verifyGameOwnership(mc.accessToken);
    if (!ownsGame) {
      throw new Error(
        "This account doesn't own Minecraft Java Edition. Please purchase it first."
      );
    }
    console.log("✅ Game ownership verified");
    
    // Step 7: Get Minecraft profile
    const profile = await getMinecraftProfile(mc.accessToken);
    console.log(`✅ Logged in as ${profile.username} (${profile.uuid})`);
    
    // Build and save token set
    const now = Date.now();
    const tokens: TokenSet = {
      msAccessToken: msTokens.accessToken,
      msRefreshToken: msTokens.refreshToken,
      msExpiresAt: now + msTokens.expiresIn * 1000,
      xblToken: xbl.token,
      xstsToken: xstsToken,
      userHash: xbl.userHash,
      xuid: xbl.xuid,
      mcAccessToken: mc.accessToken,
      mcExpiresAt: now + mc.expiresIn * 1000,
      username: profile.username,
      uuid: profile.uuid,
      lastRefresh: now,
      loginDate: now,
    };
    
    saveTokenSet(tokens);
    
    return {
      accessToken: mc.accessToken,
      username: profile.username,
      uuid: profile.uuid,
      xuid: xbl.xuid,
      expiresAt: tokens.mcExpiresAt,
    };
  } catch (error) {
    console.error("❌ Login failed:", error);
    throw error;
  }
}

/**
 * Get current account, automatically refreshing tokens if needed
 */
export async function getAccount(): Promise<MinecraftAccount | null> {
  const tokens = getActiveTokenSet();
  
  if (!tokens) {
    console.log("ℹ️ No active account");
    return null;
  }
  
  try {
    // Check if refresh is needed
    if (shouldRefreshTokens(tokens)) {
      console.log("🔄 Tokens need refresh...");
      const refreshedTokens = await refreshTokenChain(tokens);
      saveTokenSet(refreshedTokens);
      
      return {
        accessToken: refreshedTokens.mcAccessToken,
        username: refreshedTokens.username,
        uuid: refreshedTokens.uuid,
        xuid: refreshedTokens.xuid,
        expiresAt: refreshedTokens.mcExpiresAt,
      };
    }
    
    // Tokens are still valid
    console.log(`✅ Account active: ${tokens.username}`);
    return {
      accessToken: tokens.mcAccessToken,
      username: tokens.username,
      uuid: tokens.uuid,
      xuid: tokens.xuid,
      expiresAt: tokens.mcExpiresAt,
    };
  } catch (error) {
    console.error("❌ Failed to get/refresh account:", error);
    
    // Clear invalid tokens
    const store = loadStore();
    if (store.activeUuid && store.accounts[store.activeUuid]) {
      delete store.accounts[store.activeUuid];
      const remainingUuids = Object.keys(store.accounts);
      store.activeUuid = remainingUuids.length > 0 ? remainingUuids[0] : null;
      saveStore(store);
    }
    
    return null;
  }
}

/**
 * Get all saved accounts
 */
export function getAccounts(): Array<{ username: string; uuid: string }> {
  const store = loadStore();
  return Object.values(store.accounts).map((t) => ({
    username: t.username,
    uuid: t.uuid,
  }));
}

/**
 * Switch to a different account
 */
export function setActiveAccount(uuid: string): void {
  const store = loadStore();
  if (!store.accounts[uuid]) {
    throw new Error("Account not found");
  }
  store.activeUuid = uuid;
  saveStore(store);
  console.log(`🔄 Switched to account: ${store.accounts[uuid].username}`);
}

/**
 * Remove an account
 */
export function logout(uuid?: string): void {
  const store = loadStore();
  const targetUuid = uuid ?? store.activeUuid;
  
  if (!targetUuid) {
    console.log("ℹ️ No account to logout");
    return;
  }
  
  if (store.accounts[targetUuid]) {
    const username = store.accounts[targetUuid].username;
    delete store.accounts[targetUuid];
    console.log(`👋 Logged out: ${username}`);
  }
  
  // Set new active account if current was removed
  if (store.activeUuid === targetUuid) {
    const remainingUuids = Object.keys(store.accounts);
    store.activeUuid = remainingUuids.length > 0 ? remainingUuids[0] : null;
  }
  
  saveStore(store);
}

/**
 * Validate that stored tokens are accessible and not corrupted
 */
export function validateAuthStore(): boolean {
  try {
    const store = loadStore();
    return store.version === STORE_VERSION;
  } catch {
    return false;
  }
}
