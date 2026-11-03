import { EventEmitter } from "events";
import { getAccount, MinecraftAccount } from "./auth";

// =============================================================================
// AUTH STATE MANAGER
// =============================================================================

export class AuthStateManager extends EventEmitter {
  private currentAccount: MinecraftAccount | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private lastError: Error | null = null;
  
  // Check authentication every 2 minutes
  private static readonly CHECK_INTERVAL = 2 * 60 * 1000;
  
  constructor() {
    super();
  }
  
  /**
   * Initialize the auth manager and start monitoring
   */
  async initialize(): Promise<void> {
    console.log("🔐 Initializing auth state manager...");
    
    try {
      // Load existing account
      this.currentAccount = await getAccount();
      
      if (this.currentAccount) {
        console.log(`✅ Restored session: ${this.currentAccount.username}`);
        this.emit("authenticated", this.currentAccount);
      } else {
        console.log("ℹ️ No active session found");
        this.emit("unauthenticated");
      }
      
      // Start monitoring
      this.startMonitoring();
    } catch (error) {
      console.error("❌ Failed to initialize auth state:", error);
      this.lastError = error as Error;
      this.emit("error", error);
    }
  }
  
  /**
   * Start periodic token refresh monitoring
   */
  private startMonitoring(): void {
    if (this.refreshInterval) {
      return;
    }
    
    this.refreshInterval = setInterval(async () => {
      await this.checkAndRefresh();
    }, AuthStateManager.CHECK_INTERVAL);
    
    console.log("👁️ Auth monitoring started");
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log("🛑 Auth monitoring stopped");
    }
  }
  
  /**
   * Check current account status and refresh if needed
   */
  async checkAndRefresh(): Promise<void> {
    if (this.isRefreshing) {
      console.log("⏭️ Refresh already in progress, skipping");
      return;
    }
    
    if (!this.currentAccount) {
      return;
    }
    
    try {
      this.isRefreshing = true;
      
      const account = await getAccount();
      
      if (!account) {
        // Account lost - notify listeners
        console.warn("⚠️ Account session lost!");
        this.currentAccount = null;
        this.lastError = new Error("Session expired");
        this.emit("unauthenticated");
        this.emit("session-lost");
      } else if (account.uuid !== this.currentAccount.uuid) {
        // Account changed
        console.log(`🔄 Account changed: ${account.username}`);
        this.currentAccount = account;
        this.lastError = null;
        this.emit("authenticated", account);
      } else {
        // Account still valid, update tokens
        this.currentAccount = account;
        this.lastError = null;
      }
    } catch (error) {
      console.error("❌ Failed to refresh account:", error);
      this.lastError = error as Error;
      this.emit("error", error);
    } finally {
      this.isRefreshing = false;
    }
  }
  
  /**
   * Force a manual refresh
   */
  async forceRefresh(): Promise<MinecraftAccount | null> {
    console.log("🔄 Forcing auth refresh...");
    await this.checkAndRefresh();
    return this.currentAccount;
  }
  
  /**
   * Update current account (called after login/logout)
   */
  updateAccount(account: MinecraftAccount | null): void {
    const wasAuthenticated = !!this.currentAccount;
    const isAuthenticated = !!account;
    
    this.currentAccount = account;
    this.lastError = null;
    
    if (isAuthenticated && !wasAuthenticated) {
      console.log(`✅ User logged in: ${account!.username}`);
      this.emit("authenticated", account);
    } else if (!isAuthenticated && wasAuthenticated) {
      console.log("👋 User logged out");
      this.emit("unauthenticated");
    }
  }
  
  /**
   * Get current account without refreshing
   */
  getCurrentAccount(): MinecraftAccount | null {
    return this.currentAccount;
  }
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.currentAccount;
  }
  
  /**
   * Get last error
   */
  getLastError(): Error | null {
    return this.lastError;
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    this.currentAccount = null;
    this.lastError = null;
  }
}

// Singleton instance
let authStateManager: AuthStateManager | null = null;

/**
 * Get the global auth state manager instance
 */
export function getAuthStateManager(): AuthStateManager {
  if (!authStateManager) {
    authStateManager = new AuthStateManager();
  }
  return authStateManager;
}

/**
 * Initialize auth state manager on app startup
 */
export async function initializeAuthState(): Promise<void> {
  const manager = getAuthStateManager();
  await manager.initialize();
}
