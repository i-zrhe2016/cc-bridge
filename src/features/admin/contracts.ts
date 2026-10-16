export interface AdminProvider {
  id: string;
  name: string;
  endpoint: string;
  models: string[];
  enabled: boolean;
  owned: boolean;
  editable: boolean;
  protocol: string;
}
export interface AdminKey {
  id: string;
  name: string;
  mask: string;
  createdAt: string;
  expiresAt: string | null;
  active: boolean;
  owned: boolean;
}
export interface ProviderList { providers: AdminProvider[]; revision: string }
export interface KeyList { keys: AdminKey[]; revision: string }
export interface GatewayState { state: 'running' | 'stopped' | 'starting' | 'error' | 'unknown'; management: boolean }
export interface UsagePoint { label: string; requests: number; input: number; output: number }
export interface AdminUsage { series: UsagePoint[]; requests: number; input: number; output: number }
export interface AdminOverview { providers: number; activeKeys: number; gateway: GatewayState; usage: AdminUsage }
export interface MutationResult { message: string; secret?: string }
export type AdminSection = 'overview' | 'providers' | 'keys' | 'usage' | 'system';
