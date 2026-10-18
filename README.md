# CC Bridge

已增加 CCR 3.1.3 真实后端接入。保留现有工作台，原样运行 CCR，通过服务端调用其原生接口管理连接、密钥和用量。配置方式、服务模板和联调测试见 [CCR 接入说明](docs/ccr-integration.md)。用户工作台仅支持 Google 登录；认证或后端未配置时不开放演示，见 [Google 认证说明](docs/google-auth.md)。

CC Bridge 将 GPT 接入 Claude Code。项目基于 [ixartz/SaaS-Boilerplate](https://github.com/ixartz/SaaS-Boilerplate) 的精简基础，使用 Next.js、React、TypeScript、Tailwind CSS v4 和 shadcn/ui。模板版本与许可见 [模板来源](docs/template-source.md)。

新增独立管理后台 `/admin`：多连接、多密钥、用量汇总与网关控制，使用独立后台口令；配置与使用见 [管理后台说明](docs/admin.md)。

## 本地运行与 Google 登录

需要 Node.js 24 和 Bun。仅支持 Google 登录注册，首次授权自动创建账号。配置 Clerk Google-only 实例、持久化数据库、CCR 和旧资源迁移见 [Google 认证说明](docs/google-auth.md)。

```bash
bun install --frozen-lockfile
# 将 deployment/auth.env.example 配置合并到 .env.local，填入所选 Clerk 实例 key
bun run auth:migrate
bun run dev
```

打开 `http://localhost:3000`。未配置认证时登录按钮禁用，工作台不会开放免登录演示。

- `/auth/sign-in`：统一 Google 登录注册入口；旧登录、注册路径继续重定向至这里。
- `/dashboard`：登录后使用个人工作台，连接、密钥、模型访问及用量按用户隔离。
- `/admin`：使用独立后台口令管理全局 CCR 资源，不授予普通 Google 用户后台权限。

应用账号与归属保存于 SQLite，认证会话由 Clerk 管理，上游连接与用量保存在 CCR。构建不执行数据库迁移，不需要 Clerk key。生产部署须先配置所选 Clerk 实例、Google-only 策略与 HTTPS 域名。

## 浏览器验收

```bash
bunx playwright install chromium
bun run build
bun run test:e2e
```

页面测试启动独立生产服务（端口 3100），覆盖未配置认证提示、路由兼容、旧页面移除、官网多语言、配置复制和 375/768/1440px 布局。真实会话和多用户隔离使用 `bun run test:ccr` 验证。截图保存在 `test-results/`。

实现边界见 [开发与认证说明](docs/cc-bridge.md)。

## 工作台来源

工作台布局移植自 Apptension SaaS Boilerplate，来源及适配说明见 [模板来源](docs/template-source.md)。原型的演示服务仍保留在代码中供组件参考，公开 `/dashboard` 已统一使用 Google 会话和真实后端。
