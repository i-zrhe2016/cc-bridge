# CCR 直接对接

CC Bridge 工作台调用未经修改的 CCR **3.1.3** 管理 RPC。CCR 独立运行，通过其原生配置数据库、客户端密钥和用量统计实现持久化。依赖及完整依赖版本锁定在 `deployment/ccr-runtime/package.json` 和 `npm-shrinkwrap.json`，不包含在浏览器依赖中。

## 已实现

- `/dashboard`：配置后展示真实工作台，使用独立管理口令进入；未配置 `CCR_MANAGEMENT_URL` 时保持演示模式。
- `/api/workspace/session`：管理口令登录、退出，使用 8 小时 HttpOnly、SameSite=Strict 签名 Cookie；HTTPS 地址启用 Secure。口令至少 32 字符，须与 CCR 管理令牌不同。
- `/api/workspace`：登录后读取连接、当前访问密钥和七天实际用量；POST 支持保存连接、生成／更换密钥、停用密钥、删除连接。写操作检查 Origin。
- `/v1/messages`、`/v1/messages/count_tokens`、`/v1/models`：将请求转给 CCR 网关，使用 CCR 原生客户端密钥鉴权。成功 JSON/SSE 不做协议转换；响应头采用白名单，非成功 HTTP 错误转换为 CC Bridge 提示。请求中断传递到 CCR，最长请求时间为 10 分钟。
- 配置命令使用 CC Bridge 公开地址和 CCR 的 `供应商名/模型` 选择器，同时设置 Opus、Sonnet、Haiku 对应的模型。

工作台管理一条带固定 ID 的供应商和一枚带固定 ID 的客户端密钥；保留 CCR 中其他供应商、密钥及设置。编辑连接时密钥留空保留原密钥，更换后旧客户端密钥失效，删除连接先撤销其客户端密钥。完整配置保存保留 CCR 的 `configRevision`，发生外部并发修改时返回 409，不强行覆盖。

这是单个管理员管理的工作台。当前 Google 登录仍为演示，不与管理会话关联，也没有多用户隔离。CCR 客户端密钥拥有该 CCR 实例提供的模型访问权限；需要独立实例，不应与其他租户共享。

## 本地运行

```bash
npm ci --prefix deployment/ccr-runtime
```

从 `deployment/ccr.env.example` 创建本地私有配置，设置随机 `CCR_WEB_AUTH_TOKEN`。使用独立的运行用户／数据目录运行：

```bash
./deployment/ccr-runtime/node_modules/.bin/ccr serve --host 127.0.0.1 --port 3458 --no-open
```

CCR 管理端口默认 3458，网关默认 3456，内部核心默认 3457；三者保持监听 `127.0.0.1`。现有 CCR 也可直接使用，须为 3.1.3，且这些端口未被其他服务占用。不要将 CCR 自带管理界面代理到公开工作台。

将 `deployment/workspace.env.example` 的变量填入项目根目录 `.env.local`，其中 `CCR_WEB_AUTH_TOKEN` 与 CCR 的值相同，`CC_BRIDGE_ADMIN_TOKEN` 使用另一枚随机值，`CC_BRIDGE_PUBLIC_URL` 填实际 Next.js 地址，如 `http://localhost:3000`。两个令牌均可用 `openssl rand -hex 32` 分别生成，不能使用示例占位值。

```bash
bun run dev
```

进入 `/dashboard`，输入 CC Bridge 管理口令，填写上游地址（例如 `https://api.openai.com/v1`）、API 密钥和支持工具调用的模型。当前表单使用 OpenAI Chat Completions 协议。保存不等于上游连通性测试；之后生成访问密钥，复制命令到装有 Claude Code 的终端验证。

上游密钥只提交到 CC Bridge 服务端，再通过管理 RPC 保存至 CCR；页面只获得掩码。管理令牌不进入客户端构建。CCR 数据目录及备份包含敏感配置，需要作为秘密保管。

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

`test:ccr` 启动独立的原版 CCR、临时数据目录、模拟 OpenAI 上游和 Next.js 生产服务，使用 3110、3466—3468、3470—3471 端口。覆盖管理登录与越权拦截、刷新持久化、空密钥保留、真实密钥更换和撤销、模型请求、token 计数、流式工具调用及工具结果回传、真实用量和退出。不会调用收费模型，也不使用生产令牌。

真实 GPT 服务的图片、思考能力、Claude Code 子代理／压缩／会话恢复仍需在部署后用目标模型实测；本次接入不承诺全功能兼容。CCR 的 MIT 许可保留在 `docs/licenses/CCR-MIT.txt`，随现有镜像许可目录发布。服务端 RPC 失败不返回原始内部错误；成功的模型流保持原样，其中上游嵌入的流内错误内容也由 CCR 原样提供。
