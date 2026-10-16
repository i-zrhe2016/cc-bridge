# 开发与认证边界

## 页面组织

首页使用 `src/features/landing` 的 React 组件、翻译数据和限定在 `.landing-page` 内的 CSS，避免影响模板组件。语言优先级为已保存选择、浏览器偏好、英文；初次服务端输出为简体中文。剪贴板不可用时选中配置并显示手动复制提示。

登录页位于 `/auth/sign-in`，小于 1024px 时使用单栏。Google 登录与注册共用一个入口，`/auth/sign-up` 及其子路径均返回该入口。新页面首版使用简体中文。Logo 和「返回首页」链接指向 `/`。

公共根布局不初始化 Clerk，不加载外部字体；模板的后台 Provider、主题、Query 和 Nuqs 集成保留在后台布局中。公共页面不会因缺少认证密钥而弹出 Clerk 开发配置窗口。Sentry 仅在配置 DSN 且未显式禁用时启用。

## 当前认证状态

`GoogleContinueButton` 的 `handleGoogleContinue` 是后续 OAuth 接入位置。目前仅在 `role=status` 的提示区显示即将开放文案，重复点击保持单条提示。

`src/lib/auth-config.ts` 检查 Clerk 的公开密钥和服务端密钥。两者未同时配置时，代理层将 `/dashboard` 和所有后台子路由重定向至登录页；模板 API 返回 503，避免访问或修改演示数据。后台布局也在调用 `auth.protect()` 前检查配置。

配置两项密钥不会启用本期 Google 按钮，真实认证接入仍需后续实现和验收。不得把密钥放入浏览器代码或提交到 Git。

## 后续真实接入

沿用模板 Clerk 集成，配置 Google 为唯一登录方式，连接统一按钮、授权回调和会话。验证新用户首次授权、已有用户登录、取消与失败、退出及后台/API 权限后，再开放后台。当前不实现账号库、OAuth 回调或任何生产登录能力。

环境变量示例见 `env.example.txt`。官网入口已指向 `/auth/sign-in`，接入指南仍保留在 `/#start`。

## 验证与运行方式

`bun run dev` 与 `bun run build` 使用 Next.js 的 Webpack 模式，兼容依赖目录位于其他挂载点的开发环境。根布局使用本地系统字体，构建无需请求 Google Fonts。

`bun run test:e2e` 使用已构建的生产产物，启动端口 3100 的独立服务并清空认证密钥。测试覆盖 Google 按钮无授权请求/会话副作用、入口重定向、未配置时的 API 拒绝、10 种语言、复制及其降级、375/768/1440px 布局。需要先运行 `bunx playwright install chromium` 和 `bun run build`。
