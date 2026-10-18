# Clerk Google 登录与用户工作台

认证、首次注册、浏览器会话和退出由 Clerk 管理。仅使用 Google；本地 SQLite 保存应用用户、Clerk/Google 身份绑定和资源归属，不再认证旧 Better Auth Cookie。原有用户 ID、CCR 资源 ID、密钥与用量保持不变。管理员仍使用独立口令。

## 指定应用与配置

仅使用已选应用 `app_3IwQfJoe0B5qP5nQaaGSDwchNAr`。本项目已接入 @clerk/nextjs 7，**不要运行 init**、创建替代应用或覆盖已有密钥。用户先在主机终端完成 `npx -y clerk@latest auth login`；确认项目链接目标后，才可按需使用 `link --app app_3IwQfJoe0B5qP5nQaaGSDwchNAr` 和 `env pull` 恢复开发密钥。不要把密钥贴到聊天、客户端源码或仓库。

在该应用的 Clerk Dashboard 开启 Google，关闭其他社交提供商、邮箱验证码/链接、密码与手机号登录；设置注册必填字段为 Google 可提供的字段，不额外要求用户名或手机号。统一的预构建 `<SignIn withSignUp>` 使用这份实例配置，不能靠 UI 隐藏替代后端配置。Google OAuth 客户端及重定向 URI 按 Clerk Dashboard 展示值配置，旧 `/api/auth/callback/google` 已退役。

当前本地开发环境已链接上述应用的开发实例，CLI 已将密钥写入未纳入版本控制的 `.env.local`，并回读确认仅 Google 可登录。按用户要求，预览监听 `192.168.42.130:3100`，登录地址为 `http://192.168.42.130:3100/auth/sign-in`；`CC_BRIDGE_PUBLIC_URL` 同步为该 origin。使用独立的 `./data/clerk-development.sqlite`，不修改生产数据库。`clerk doctor` 已通过；未配置生产实例和 shell 补全的提示不影响开发登录。此预览已连接独立的真实 CCR 开发实例，管理／网关／核心端口为回环地址的 3368／3366／3367，数据与生产 CCR 分开。启动与重启说明见 [CCR 接入说明](ccr-integration.md#当前内网开发实例)。首次进入工作台需填写自己的上游连接；当前只允许 `https://api.openai.com`，其他 origin 需由管理员明确加入白名单。

当前 Linux 宿主的原进程会话读取 keyring 时出现 `KeyRevoked`；本次 CLI 检查与配置在新建的进程专用 keyring 会话中完成，使用已有登录凭据，没有清空密钥环或重复授权。普通终端若再次报告未登录，应检查宿主 keyring 会话；不要运行 `init` 创建替代应用。网站运行使用已写入的开发密钥，不依赖 CLI 的 keyring 会话。

将 deployment/auth.env.example 中的变量合并到本地私有配置，保留现有值：

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`：所选开发实例公开 key，构建时提供；允许出现在浏览器。
- `CLERK_SECRET_KEY`：同一实例的服务端 key，绝不能使用 NEXT_PUBLIC 前缀。
- `CC_BRIDGE_PUBLIC_URL=http://192.168.42.130:3100`：当前开发预览的完整 origin，用于限制 Clerk 会话 authorized party 和工作台写入 Origin。更换访问地址时同步修改。
- `CC_BRIDGE_DATABASE_PATH=./data/auth.sqlite`：应用身份与归属数据库，部署时放在发布目录外。
- `NEXT_PUBLIC_CLERK_KEYLESS_DISABLED=true`：禁用 SDK 无 key 自动配置。缺 key 的页面显示未配置，工作台 fail closed；代码不会创建 Clerk 应用。

```bash
bun install --frozen-lockfile
bun run auth:migrate
bun run dev --hostname 192.168.42.130 --port 3100
```

访问 `/auth/sign-in`；首次 Google 授权自动注册，已登录用户进入 `/dashboard`。`src/proxy.ts` 使用官方 clerkMiddleware；服务端使用异步 auth() 验证会话，再向 Clerk Backend API 读取 Google 身份及其验证状态。只接受唯一、已验证的 Google providerUserId 与已验证邮箱。无 Google、未验证、冲突、过期、伪造 token 或 Backend API 故障均拒绝工作台访问。`/v1` 桥接密钥与 `/admin` 独立认证不经过 Clerk Bearer 认证。

ClerkProvider 仅挂载在 `/auth` 和 `/dashboard` 布局，供登录与账号退出组件使用；公开首页与独立管理员页面不加载 Clerk 前端脚本。

## 原身份迁移

先备份数据库和 CCR 数据，停止 Web 写入后运行 auth:migrate。该命令不需要云端 key，可重复执行，只增加缺失表，保留历史 account/user/session 表和所有外键、工作区。历史认证记录仅供迁移，旧 Cookie 和旧 OAuth 路由不能登录。

首次有效 Clerk Google 登录仅按 Backend API 的已验证 Google subject 匹配历史 account(providerId=google, accountId=subject)，继承原本地用户 ID；绝不按邮箱或客户端 metadata 自动关联。Clerk 用户、Google subject、本地用户一对一唯一绑定，重复或冲突拒绝。相同邮箱的不同 Google 身份不会接管原工作区（历史邮箱唯一约束也可能使新身份无法注册，需管理员审核后处理，不能自动合并）。旧会话不能转移，所有用户必须重新登录 Google。新用户只创建一次本地应用身份。

连接保存要求 `CC_BRIDGE_UPSTREAM_ORIGINS` 为管理员信任的 API origin 逗号列表，例如 `https://api.openai.com,https://api.example.com`，不含路径。缺失或空值拒绝保存；本地测试可显式允许 `http://127.0.0.1:3470`。开放注册用户不能自行选择任意内网或元数据地址。允许列表中的主机、DNS、重定向行为及其网络访问权限属于管理员信任边界；应仅允许可信服务，并用部署网络出站策略限制其可达范围。

## 用户隔离

每个账号一条连接、一枚桥接密钥。显示名称可以重复，CCR 内部名称唯一且保持稳定，使改名后仍能查询同一连接的历史用量。API 从服务端会话获取所有者，不接受客户端所有者字段。上游密钥仅留在 CCR，浏览器只看到掩码。

`/api/auth/[...all]` 是已退役端点，返回 410；Clerk 管理授权、会话和退出；旧 `/api/workspace/session` 返回 410，不再接受管理口令。`/api/workspace` 仅接受 Google 会话，写操作检查 Origin。`/admin` 继续使用独立后台口令，与 Google 用户权限分开。

公开 `/v1` 验证桥接密钥当前有效且已绑定用户，只允许该用户自己的 `内部连接名/模型`，模型列表也只返回自己的模型。客户端路由头和查询参数不会传给 CCR；服务器固定目标连接和模型。CCR 的自定义全局路由、内置路由、启用的插件、profile 路由、路由规则和跨连接 fallback 可能绕过租户边界，启用这些配置时公开网关拒绝请求。将 `Router.builtInRules` 中所有条目的 `enabled` 显式设为 `false`（CCR 默认启用内置路由）。CCR 管理、核心和网关端口必须只绑定回环地址，不可直接公开。

CCR 配置持久化与运行中网关加载配置是两个步骤。原版 CCR 在管理端连续重启、恢复配置后的运行时加载可能超时；本服务保留错误并返回 502，不将保存成功视为网关已可用。遇到这类错误，应由管理员检查 CCR 网关状态和配置版本，并安排停止后重新启动；不要盲目重复提交连接配置。自动测试在独立场景结束时恢复配置、密钥和原有停止状态，避免把重启压力场景的运行时状态带入下一场景。

后台可管理全部资源，但用户工作台资源不能由后台直接删除或停用连接，用户密钥不能从后台删除或更换；管理员可撤销密钥。管理员修改用户连接仍须保留内部名称及单模型结构。后台单独创建的、未绑定用户的密钥仅在私有 CCR 网关使用，不能访问公开 `/v1`。

## 旧工作台迁移

先让目标账号完成 Clerk Google 登录。旧共享资源保持管理员可见，不会自动归给首个注册用户；未迁移旧密钥在公开 `/v1` 返回 403。迁移期间需要安排旧密钥的短暂不可用窗口。

备份认证数据库与 CCR 数据，暂停工作台写入或停止 Web 服务，在与服务相同的环境变量、Node.js 版本和操作系统用户下执行：

```bash
bun run workspace:migrate --email=owner@example.com
bun run workspace:migrate --email=owner@example.com --apply
```

默认只预览。实际迁移要求目标邮箱对应唯一的已登录、已验证 Clerk Google 本地身份，且该账号尚无自己的 CCR 连接或密钥。迁移只在 SQLite 中绑定现有固定资源 ID，不修改 CCR 名称、密钥值或历史数据，因此原模型选择器和旧密钥在绑定后继续有效。重复执行同一目标安全；资源已属于其他账号、目标不存在或已有独立资源时拒绝。命令不打印凭证。

## 部署与回退

本次仅完成本地代码，不修改生产服务。正式部署先在所选应用创建/配置生产实例与 HTTPS 域名，提供同实例 key，重新构建公开 key，显式执行本地 SQL 迁移后启动。Clerk secret 只留在服务器；Google secret 由 Clerk 管理，不再设置 GOOGLE_CLIENT_SECRET 或 BETTER_AUTH_SECRET。


SQLite 方案要求 Node.js 24 与可写持久磁盘，面向单机，不支持无持久盘 Serverless 或多副本共享文件。迁移 CLI 需要完整仓库依赖，standalone Web 不包含运维命令。构建不执行数据库迁移。数据库启用 WAL：使用 SQLite backup API，或停止服务后一并备份主库、-wal、-shm；与 CCR 数据和部署版本配套。回退前限制公开访问并恢复配套备份，不自动删除绑定或退回旧会话。

## 验证边界

```bash
bun run typecheck
bun run lint
bun run build
bun run test:auth
bun run test:e2e
bun run test:ccr
```

本地网络 fixture 只在测试 Node preload 中响应 Clerk JWKS/Backend API，实际 SDK 验证 RS256 会话、issuer、authorized party、过期和签名，之后才读取权威 Google profile 并绑定本地身份；浏览器测试使用该测试密钥签名的 __session Cookie，桥接请求独立提供自己的 Bearer key；不会用全局 Authorization 覆写二者。无生产测试登录端点或可切换的认证绕过。CCR 使用原版独立原生实例，覆盖同场景两用户隔离、模型/密钥/用量、迁移、管理员、工具/SSE 等。

有效 Clerk 会话若缺少已验证 Google 身份或与现有身份绑定冲突，工作台和登录页会显示明确拒绝信息及 Clerk 官方退出按钮，避免登录跳转回环。API 仍返回 401，不会根据相同邮箱自动关联旧工作台。

本地 CCR 集成测试将 Next.js 监听地址、公开 origin、请求 Host 与签名 azp 统一为 http://localhost:3110，并保留 Next.js 默认 URL/Flight header 规范化。使用 localhost 启动本地 Clerk 测试；反向代理部署须将 CC_BRIDGE_PUBLIC_URL 配置为实际 HTTPS 公开域名并传递一致的 Host。此前 127.0.0.1 与 localhost 自重写不一致及跳过规范化的组合会触发启动超时或 RSC 500，未声称该组合受支持。

匿名开发浏览器首先由实际 SDK 重定向至 Clerk handshake；测试断言该响应，再设置仅标识开发浏览器同步完成的 __clerk_db_jwt marker，以测试无会话登录跳转。marker 不提供签名会话，工作台 API 仍须返回 401；fixture 不实现远端 handshake。

这些本地测试不代表已验证托管 Google 同意屏幕、会话续期或远端退出/撤销。本次另用真实开发实例自验证了 Clerk 登录组件：桌面与手机宽度均显示 Google 按钮，没有邮箱/密码输入框、水平溢出或页面错误。主机 CLI 登录、同实例开发 key 和 Google-only 配置已完成；用户已完成一次真实 Google 登录并建立本地身份绑定，进入了工作台的后端配置检查。返回登录、会话刷新和退出仍待人工验证。使用官方 @clerk/testing 的 clerkSetup/setupClerkTestingToken（仅开发实例）处理自动化防机器人检测；它不能跳过 Google OAuth。用两个获准 Google 测试账号逐一验证首次注册、返回登录、刷新、退出/过期、跨用户隔离和后台拒绝。不创建测试用户，除非用户另行授权。

参考：[Next.js 集成](https://clerk.com/docs/nextjs/getting-started/quickstart)、[Google](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/google)、[身份迁移](https://clerk.com/docs/guides/development/migrating/overview)、[官方 Playwright 测试](https://clerk.com/docs/guides/development/testing/playwright/overview)。
