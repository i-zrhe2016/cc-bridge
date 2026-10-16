# CC Bridge

已增加 CCR 3.1.3 真实后端接入。保留现有工作台，原样运行 CCR，通过服务端调用其原生接口管理连接、密钥和用量。配置方式、服务模板和联调测试见 [CCR 接入说明](docs/ccr-integration.md)。下文的模拟行为仅适用于未配置后端时。

CC Bridge 将 GPT 接入 Claude Code。项目基于 [ixartz/SaaS-Boilerplate](https://github.com/ixartz/SaaS-Boilerplate) 的精简基础，使用 Next.js、React、TypeScript、Tailwind CSS v4 和 shadcn/ui。模板版本与许可见 [模板来源](docs/template-source.md)。

新增独立管理后台 `/admin`：多连接、多密钥、用量汇总与网关控制，使用独立后台口令；配置与使用见 [管理后台说明](docs/admin.md)。

## 本地运行

需要 Node.js 24 和 Bun，无需环境变量、认证密钥或数据库。

```bash
bun install --frozen-lockfile
bun run dev
```

打开 `http://localhost:3000`。

```bash
bun run typecheck
bun run lint
bun run build
bun run start
```

## 页面与模拟认证

- `/`：保留 CC Bridge 官网、10 种语言及配置复制。
- `/admin`：配置独立后台口令与 CCR 后启用的真实管理后台，未配置时显示未启用。
- `/dashboard`：配置 CCR 时使用管理口令进入真实工作台；未配置时为无需登录的用户工作台原型，支持 GPT 连接、演示桥接密钥、配置复制与示例用量；状态仅在当前页面内存中，刷新重置，不发起模型请求。
- `/auth/sign-in`：居中卡片式 Google 登录注册统一入口。
- `/auth`、`/auth/sign-up`、`/sign-in`、`/sign-up`：重定向至统一入口，兼容登录注册子路径。

点击「使用 Google 继续」后显示约 800 毫秒加载状态，再显示模拟成功提示。不会连接 Google、调用认证 API、保存账号或创建会话；刷新后恢复初始状态。此页面不是可用于生产的认证系统。

旧模板示例后台和示例 API、Clerk、数据库、组织管理及监控已移除；新管理后台使用独立口令认证与 CCR 持久化。启动和构建不执行数据库迁移，也不加载外部字体。

## 浏览器验收

```bash
bunx playwright install chromium
bun run build
bun run test:e2e
```

测试启动独立生产服务（端口 3100），覆盖模拟登录、无请求与存储副作用、路由兼容、旧页面移除、官网多语言、配置复制和 375/768/1440px 布局。截图保存在 `test-results/`。

实现边界见 [开发与认证说明](docs/cc-bridge.md)。

## 演示模式工作台

工作台前端移植自 Apptension SaaS Boilerplate 的布局、侧栏、Header 和 Card，适配现有 Next.js。左侧提供 GPT 连接、桥接密钥、接入配置、用量概览四栏，手机端显示顶部四项按钮。来源及适配说明见 [模板来源](docs/template-source.md)。

从官网「体验工作台」或 `/dashboard` 进入。请使用测试密钥；保存后只保留掩码，上游密钥不会进入 Claude Code 配置。桥接密钥与网关地址均为演示值，不能真实调用。当前不接入认证、数据库或真实路由服务。详细边界见 [开发说明](docs/cc-bridge.md)。
