export interface ConnectionInput { name: string; endpoint: string; apiKey: string; model: string }
export type Connection = Omit<ConnectionInput, 'apiKey'> & { keyMask: string };
export interface WorkspaceState { connection: Connection | null; bridgeKey: string | null }
export interface UsageDay { label: string; requests: number; input: number; output: number }

export interface WorkspaceService {
  saveConnection: (input: ConnectionInput, previous: Connection | null) => Connection;
  createBridgeKey: () => string;
  getUsage: () => UsageDay[];
}

// Saved connections retain only a credential mask. No I/O or persistence.
export const demoService: WorkspaceService = {
  saveConnection(input, previous) {
    return {
      name: input.name.trim(),
      endpoint: input.endpoint.trim(),
      model: input.model.trim(),
      keyMask: input.apiKey.trim() ? '••••••••' : (previous?.keyMask ?? ''),
    };
  },
  createBridgeKey: () => `ccb_demo_${Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')}`,
  getUsage: () => [
    { label: '周一', requests: 24, input: 42000, output: 8000 },
    { label: '周二', requests: 38, input: 66000, output: 12000 },
    { label: '周三', requests: 19, input: 31000, output: 6000 },
    { label: '周四', requests: 52, input: 87000, output: 18000 },
    { label: '周五', requests: 41, input: 71000, output: 13000 },
    { label: '周六', requests: 16, input: 25000, output: 5000 },
    { label: '周日', requests: 30, input: 48000, output: 9000 },
  ],
};

export function validateConnection(input: ConnectionInput, editing: boolean): string | null {
  const missing = [
    !input.name.trim() && '名称',
    !input.endpoint.trim() && 'API 地址',
    !editing && !input.apiKey.trim() && 'GPT 密钥',
    !input.model.trim() && '模型',
  ].filter(Boolean);
  if (missing.length) {
    return `请填写${missing.join('、')}。`;
  }
  try {
    const url = new URL(input.endpoint.trim());
    if (!['https:', 'http:'].includes(url.protocol)) {
      return '地址格式不正确，请填写以 http:// 或 https:// 开头的 API 地址。';
    }
    if (url.username || url.password) {
      return 'API 地址中不能包含账号或密码，请复制服务商提供的 API 地址。';
    }
  }
  catch {
    return '地址格式不正确，请填写以 http:// 或 https:// 开头的 API 地址。';
  }
  return null;
}

// Quote user-supplied values as shell literals, including embedded quotes.
const shellQuote = (value: string) => `'${value.replaceAll('\'', '\'\\\'\'')}'`;
export function buildConfiguration(state: WorkspaceState, gatewayUrl?: string, gatewayModel?: string): string {
  if (!state.connection || !state.bridgeKey) {
    return '';
  }
  return [
    gatewayUrl ? '# CC Bridge 接入配置' : '# CC Bridge 演示命令，暂不能实际使用',
    `export ANTHROPIC_BASE_URL=${shellQuote(gatewayUrl || 'https://gateway.example.invalid')}`,
    `export ANTHROPIC_AUTH_TOKEN=${shellQuote(state.bridgeKey)}`,
    `export ANTHROPIC_MODEL=${shellQuote(gatewayModel || state.connection.model)}`,
    ...(gatewayUrl
      ? [
          'unset ANTHROPIC_API_KEY',
          `export ANTHROPIC_DEFAULT_OPUS_MODEL=${shellQuote(gatewayModel || state.connection.model)}`,
          `export ANTHROPIC_DEFAULT_SONNET_MODEL=${shellQuote(gatewayModel || state.connection.model)}`,
          `export ANTHROPIC_DEFAULT_HAIKU_MODEL=${shellQuote(gatewayModel || state.connection.model)}`,
        ]
      : []),
    '',
    'claude',
  ].join('\n');
}
