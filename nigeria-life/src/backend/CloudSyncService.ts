import { BackendService } from './BackendService';
import type { PlayerAccount } from './types';

export interface CloudSyncInfo {
  status: 'synced' | 'syncing' | 'offline';
  lastSyncedTimestamp: number;
  lastSyncedFormatted: string;
  backupCode: string;
  serverRegion: 'lagos' | 'abuja' | 'port_harcourt';
  serverRegionName: string;
  pingMs: number;
  autoSyncEnabled: boolean;
}

export class CloudSyncService {
  private static instance: CloudSyncService;
  private readonly CLOUD_STORAGE_KEY = 'nigeria_life_cloud_backup_v2';
  private readonly CLOUD_META_KEY = 'nigeria_life_cloud_meta_v2';
  private backend = BackendService.getInstance();
  private lastSyncedTimestamp: number = Date.now();
  private backupCode: string = '';
  private serverRegion: 'lagos' | 'abuja' | 'port_harcourt' = 'lagos';
  private autoSyncInterval: number | null = null;
  private autoSyncEnabled: boolean = true;
  private listeners: Array<(info: CloudSyncInfo) => void> = [];

  private constructor() {
    this.loadMeta();
    if (!this.backupCode) {
      this.backupCode = this.generateNewBackupCode();
    }
    // Perform initial cloud snapshot
    this.saveToCloud();
    // Start auto-sync timer (every 60 seconds)
    this.startAutoSync();
  }

  public static getInstance(): CloudSyncService {
    if (!CloudSyncService.instance) {
      CloudSyncService.instance = new CloudSyncService();
    }
    return CloudSyncService.instance;
  }

  private loadMeta(): void {
    try {
      const stored = localStorage.getItem(this.CLOUD_META_KEY);
      if (stored) {
        const meta = JSON.parse(stored);
        this.backupCode = meta.backupCode || '';
        this.lastSyncedTimestamp = meta.lastSyncedTimestamp || Date.now();
        this.serverRegion = meta.serverRegion || 'lagos';
        this.autoSyncEnabled = meta.autoSyncEnabled ?? true;
      }
    } catch {
      // Storage fallback
    }
  }

  private saveMeta(): void {
    try {
      localStorage.setItem(
        this.CLOUD_META_KEY,
        JSON.stringify({
          backupCode: this.backupCode,
          lastSyncedTimestamp: this.lastSyncedTimestamp,
          serverRegion: this.serverRegion,
          autoSyncEnabled: this.autoSyncEnabled,
        })
      );
    } catch {
      // Storage fallback
    }
  }

  public generateNewBackupCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'EKO-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    code += '-NIG';
    this.backupCode = code;
    this.saveMeta();
    return code;
  }

  public saveToCloud(): boolean {
    try {
      const data = this.backend.getData();
      const payload = {
        version: '2.0.0',
        timestamp: Date.now(),
        code: this.backupCode,
        region: this.serverRegion,
        account: data,
      };

      const serialized = JSON.stringify(payload);
      localStorage.setItem(this.CLOUD_STORAGE_KEY, serialized);

      // Keyed backup by code for cross-profile recovery on same machine
      localStorage.setItem(`nigeria_cloud_code_${this.backupCode}`, serialized);

      this.lastSyncedTimestamp = Date.now();
      this.saveMeta();
      this.notifyListeners();
      return true;
    } catch (e) {
      console.warn('Cloud save error', e);
      return false;
    }
  }

  public exportBackupString(): string {
    const data = this.backend.getData();
    const payload = {
      app: 'NigeriaLife_V2',
      version: '2.0.0',
      timestamp: Date.now(),
      backupCode: this.backupCode,
      region: this.serverRegion,
      data,
    };
    const jsonStr = JSON.stringify(payload);
    return btoa(encodeURIComponent(jsonStr));
  }

  public importBackupString(input: string): { success: boolean; message: string } {
    const cleanInput = input.trim();
    if (!cleanInput) {
      return { success: false, message: 'Please provide a valid Cloud Code or Export String' };
    }

    try {
      let rawJson = '';

      // Check if it's a Cloud Code shortcut like EKO-XXXX-NIG
      if (cleanInput.startsWith('EKO-') && cleanInput.endsWith('-NIG')) {
        const storedByCode = localStorage.getItem(`nigeria_cloud_code_${cleanInput}`);
        if (!storedByCode) {
          return {
            success: false,
            message: `Cloud code ${cleanInput} not found in active cloud register. Please use the full export string for cross-device migration!`,
          };
        }
        const parsed = JSON.parse(storedByCode);
        if (parsed.account) {
          this.applyImportedAccount(parsed.account);
          this.backupCode = cleanInput;
          this.saveToCloud();
          return { success: true, message: `Successfully restored cloud save for code ${cleanInput}!` };
        }
      }

      // Base64 decoded string
      try {
        rawJson = decodeURIComponent(atob(cleanInput));
      } catch {
        rawJson = cleanInput;
      }

      const parsed = JSON.parse(rawJson);
      const targetAccount: PlayerAccount = parsed.account || parsed.data;

      if (!targetAccount || !targetAccount.username || typeof targetAccount.walletCash !== 'number') {
        return { success: false, message: 'Corrupted or invalid cloud save structure' };
      }

      this.applyImportedAccount(targetAccount);
      if (parsed.backupCode) {
        this.backupCode = parsed.backupCode;
      }
      this.saveToCloud();
      return { success: true, message: `Cloud account @${targetAccount.username} restored successfully!` };
    } catch (e: any) {
      return { success: false, message: `Failed to import cloud save: ${e?.message || 'Invalid format'}` };
    }
  }

  private applyImportedAccount(account: PlayerAccount): void {
    // Write directly into BackendService storage key and reload
    localStorage.setItem('nigeria_life_account_data_v1', JSON.stringify(account));
    // Trigger backend reload and listener notifications
    (this.backend as any).data = (this.backend as any).loadData();
    this.backend.syncPropertiesToWorld();
    (this.backend as any).notifyListeners();
  }

  public setServerRegion(region: 'lagos' | 'abuja' | 'port_harcourt'): void {
    this.serverRegion = region;
    this.saveMeta();
    this.notifyListeners();
  }

  public toggleAutoSync(): boolean {
    this.autoSyncEnabled = !this.autoSyncEnabled;
    if (this.autoSyncEnabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
    this.saveMeta();
    this.notifyListeners();
    return this.autoSyncEnabled;
  }

  private startAutoSync(): void {
    if (this.autoSyncInterval) return;
    this.autoSyncInterval = window.setInterval(() => {
      if (this.autoSyncEnabled) {
        this.saveToCloud();
      }
    }, 60000); // Every 60s
  }

  private stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
  }

  public getSyncInfo(): CloudSyncInfo {
    const elapsedSecs = Math.max(0, Math.floor((Date.now() - this.lastSyncedTimestamp) / 1000));
    let timeStr = 'Just now';
    if (elapsedSecs >= 60) {
      const mins = Math.floor(elapsedSecs / 60);
      timeStr = `${mins}m ago`;
    } else if (elapsedSecs > 5) {
      timeStr = `${elapsedSecs}s ago`;
    }

    const regionNames: Record<string, string> = {
      lagos: 'Lagos Island • Broad St Hub',
      abuja: 'Abuja FCT • Diplomatic Core',
      port_harcourt: 'Port Harcourt • Garden Hub',
    };

    const pings: Record<string, number> = {
      lagos: 15,
      abuja: 22,
      port_harcourt: 28,
    };

    return {
      status: 'synced',
      lastSyncedTimestamp: this.lastSyncedTimestamp,
      lastSyncedFormatted: timeStr,
      backupCode: this.backupCode,
      serverRegion: this.serverRegion,
      serverRegionName: regionNames[this.serverRegion] || 'Lagos Island Central',
      pingMs: pings[this.serverRegion] || 18,
      autoSyncEnabled: this.autoSyncEnabled,
    };
  }

  public subscribe(cb: (info: CloudSyncInfo) => void): () => void {
    this.listeners.push(cb);
    cb(this.getSyncInfo());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notifyListeners(): void {
    const info = this.getSyncInfo();
    for (const cb of this.listeners) {
      cb(info);
    }
  }
}
