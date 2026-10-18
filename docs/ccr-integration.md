# CCR 直接对接

用户认证、用户资源和公开网关按账号隔离，配置与旧资源迁移见 [Google 认证说明](google-auth.md)。

CC Bridge 工作台调用未经修改的 CCR **3.1.3** 管理 RPC。CCR 独立运行，通过其原生配置数据库、客户端密钥和用量统计实现持久化。依赖及完整依赖版本锁定在 `deployment/ccr-runtime/package.json` 和 `npm-shrinkwrap.json`，不包含在浏览器依赖中。

## 已实现

- `/dashboard`：使用 Google 会话进入真实工作台，未配置后端时显示不可用。
- `/api/auth/[...all]` 与旧 `/api/workspace/session` 均已退役并返回 410；Google 登录、会话期限与退出由 Clerk 管理。
- `/api/workspace`：登录后读取连接、当前访问密钥和七天实际用量；POST 支持保存连接、生成／更换密钥、停用密钥、删除连接。写操作检查 Origin。
- `/v1/messages`、`/v1/messages/count_tokens`、`/v1/models`：将请求转给 CCR 网关，使用 CCR 原生客户端密钥鉴权。成功 JSON/SSE 不做协议转换；响应头采用白名单，非成功 HTTP 错误转换为 CC Bridge 提示。请求中断传递到 CCR，最长请求时间为 10 分钟。
- 配置命令使用 CC Bridge 公开地址和 CCR 的 `供应商名/模型` 选择器，同时设置 Opus、Sonnet、Haiku 对应的模型。

每个用户管理一条带稳定独立 ID 的供应商和一枚客户端密钥；保留 CCR 中其他供应商、密钥及设置。编辑连接时密钥留空保留原密钥，更换后旧客户端密钥失效，删除连接先撤销其客户端密钥。完整配置保存保留 CCR 的 `configRevision`，发生外部并发修改时返回 409，不强行覆盖。

公开 `/v1` 在转发前验证密钥归属并固定该用户的连接与模型。CCR 原生密钥在私有端口仍具有实例权限，因此三个 CCR 端口必须只在回环网络可达。禁用 CCR 全局路由、内置路由、插件和跨连接 fallback，具体限制见 Google 认证文档。

## 本地运行

```bash
npm ci --prefix deployment/ccr-runtime
```

从 `deployment/ccr.env.example` 创建本地私有配置，设置随机 `CCR_WEB_AUTH_TOKEN`。使用独立的运行用户／数据目录运行：

```bash
./deployment/ccr-runtime/node_modules/.bin/ccr serve --host 127.0.0.1 --port 3458 --no-open
```

CCR 管理端口默认 3458，网关默认 3456，内部核心默认 3457；三者保持监听 `127.0.0.1`。现有 CCR 也可直接使用，须为 3.1.3，且这些端口未被其他服务占用。不要将 CCR 自带管理界面代理到公开工作台。

将 `deployment/workspace.env.example` 的变量填入项目根目录 `.env.local`，其中 `CCR_WEB_AUTH_TOKEN` 与 CCR 的值相同，另合并 `deployment/auth.env.example` 的 Google 与数据库设置，配置可信上游 origin 列表，`CC_BRIDGE_PUBLIC_URL` 填实际 Next.js 地址，如 `http://localhost:3000`。秘密值均可用 `openssl rand -hex 32` 独立生成，不能使用示例占位值。

```bash
bun run dev
```

先执行 `bun run auth:migrate`，进入 `/dashboard` 完成 Google 登录，填写上游地址（例如 `https://api.openai.com/v1`）、API 密钥和支持工具调用的模型。当前表单使用 OpenAI Chat Completions 协议。保存不等于上游连通性测试；之后生成访问密钥，复制命令到装有 Claude Code 的终端验证。

上游密钥只提交到 CC Bridge 服务端，再通过管理 RPC 保存至 CCR；页面只获得掩码。管理令牌不进入客户端构建。CCR 数据目录及备份包含敏感配置，需要作为秘密保管。

## 当前内网开发实例

`http://192.168.42.130:3100/dashboard` 已连接独立的原版 CCR 3.1.3。它使用现有 `/opt/cc-bridge-ccr` 安装，但数据保存在工作区的 `data/ccr-development/.claude-code-router/`，与生产数据分开。管理地址为 `http://127.0.0.1:3368`，网关为 `http://127.0.0.1:3366`，内部核心配置为 `127.0.0.1:3367`；这些端口保持回环监听。

私有管理令牌保存在 `data/ccr-development-management-token`（权限 600），已同步到未纳入版本控制的 `.env.local`。不要打印或提交令牌、上游密钥及 CCR 数据库。当前只允许 `https://api.openai.com` 上游 origin；没有创建用户连接或发起收费模型请求。新账号首次进入时连接、桥接密钥和用量为空，保存真实上游连接后启动网关，再生成自己的桥接密钥。CCR 初始化生成的实例私有默认密钥没有绑定用户，不能通过公开 `/v1` 使用。

从仓库根目录重启该 CCR 实例（确认旧的 3368 进程已停止后）：

```bash
read -r CCR_WEB_AUTH_TOKEN < data/ccr-development-management-token
export CCR_WEB_AUTH_TOKEN
export CCR_INTERNAL_HOME_DIR="$PWD/data/ccr-development"
/opt/node-v24.11.0-linux-x64/bin/node /opt/cc-bridge-ccr/node_modules/@musistudio/claude-code-router/dist/main/cli.js serve --host 127.0.0.1 --port 3368 --no-open
```

Next.js 使用 `.env.local` 中的配置，以 `bun run dev --hostname 192.168.42.130 --port 3100` 启动。备份应同时保存应用身份数据库、上述 CCR 数据目录和私有令牌；本次没有变更生产服务。

## 服务器部署准备

仓库提供 `deployment/cc-bridge-ccr.service`，沿用当前服务器的 Node.js 24 路径。部署时：

1. 创建系统用户 `cc-bridge-ccr`，将 runtime 的 package.json、npm-shrinkwrap.json 放在 `/opt/cc-bridge-ccr/`，在该目录使用服务相同的 Node.js 24 环境运行 `npm ci --omit=dev`；原生 SQLite 依赖需要与运行时 Node 版本一致。
2. 将两个环境文件分别保存为 `/etc/cc-bridge/ccr.env`、`/etc/cc-bridge/workspace.env`，设置真实随机令牌和公开地址；文件归 root 所有、权限 600，由 systemd 读取。
3. 安装 CCR service 和更新后的 CC Bridge service。CCR 的 `StateDirectory` 自动建立 `/var/lib/cc-bridge-ccr`，配置和用量在此持久化。
4. 启动 CCR 后发布 CC Bridge 构建，再启动／重启 CC Bridge。配置在运行时读取，不需要将令牌传入构建过程。
5. 从服务器执行 `ss -ltnp` 确认 3456、3457、3458 均只监听回环地址；从外部验证这三个端口不可达。公开的仅为 CC Bridge，经 HTTPS 反向代理时关闭 SSE 缓冲并设置足够的超时时间。

当前服务器已按上述方式部署，具体发布目录、凭证文件位置和回退命令见 [部署记录](deployment.md)。其他环境需要自行安装服务和配置环境变量；回退时恢复旧发布与原服务配置，保留 CCR 数据目录。

## 验证

```bash
bun run typecheck
bun run lint
bun run build
bun run test:e2e
npm ci --prefix deployment/ccr-runtime
bun run test:ccr
```

`test:ccr` 在每个独立测试场景启动全新的原版 CCR 管理进程、运行时、临时数据目录和模拟 OpenAI 上游；场景内的多个用户共享同一后端。每例结束后停止并回收测试进程组，确认全部测试端口关闭后才开始下一例。Next.js 生产服务和认证数据库在套件内共享，使用 3110、3466—3468、3470—3471 端口。覆盖管理登录与越权拦截、刷新持久化、空密钥保留、真实密钥更换和撤销、模型请求、token 计数、流式工具调用及工具结果回传、真实用量和本地测试凭据清除。本地 fixture 不验证托管 Google OAuth、Clerk 浏览器会话续期或远端退出／撤销，这些仍需指定应用实测。不会调用收费模型，也不使用生产令牌。

真实 GPT 服务的图片、思考能力、Claude Code 子代理／压缩／会话恢复仍需在部署后用目标模型实测；本次接入不承诺全功能兼容。CCR 的 MIT 许可保留在 `docs/licenses/CCR-MIT.txt`，随现有镜像许可目录发布。服务端 RPC 失败不返回原始内部错误；成功的模型流保持原样，其中上游嵌入的流内错误内容也由 CCR 原样提供。
