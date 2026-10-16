# CC Bridge

CC Bridge 将 GPT 模型接入 Claude Code。本项目基于 [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) 构建，采用 Next.js 16、React 19、TypeScript、Tailwind CSS v4 和 shadcn/ui。原模板的 MIT 许可证保留在 [LICENSE](LICENSE)。

## 本地运行

需要 Node.js 22 和 Bun。

```bash
bun install --frozen-lockfile
bun run dev
```

打开 `http://localhost:3000`。官网和登录页无需环境变量或 Clerk 账号。

```bash
bun run typecheck
bun run lint
bun run build
bun run start
```

## 浏览器验收

```bash
bunx playwright install chromium
bun run build
bun run test:e2e
```

测试会启动独立生产服务（端口 3100），检查统一登录入口、无认证时的路由保护、语言切换、配置复制及响应式布局；截图保存在被 Git 忽略的 `test-results/`。

## 页面

- `/`：官网，包含 10 种语言、产品说明、接入示例和配置复制。
- `/auth/sign-in`：Google 登录与注册统一入口，支持移动端。
- `/auth/sign-up`：重定向至统一入口。
- `/dashboard/*`：保留模板后台结构；未配置认证时返回登录页。

本期 Google 按钮显示「Google 登录即将开放，请稍后再试。」，不发起 OAuth、不创建账号或登录会话。

## 文档

- [开发与认证边界](docs/cc-bridge.md)
- [模板来源](docs/template-source.md)
- [模板 Clerk 接入说明](docs/clerk_setup.md)
- [模板主题](docs/themes.md)
- [模板权限导航](docs/nav-rbac.md)
