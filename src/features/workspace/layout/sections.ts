export const workspaceSections = [
  { id: 'connection', label: '我的 GPT', symbol: '↗' },
  { id: 'bridge', label: '访问密钥', symbol: '⌘' },
  { id: 'configuration', label: '使用教程', symbol: '⌁' },
  { id: 'usage', label: '使用统计', symbol: '▥' },
] as const;
export type WorkspaceSection = typeof workspaceSections[number]['id'];
