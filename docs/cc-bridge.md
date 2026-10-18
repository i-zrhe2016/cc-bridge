# 开发与认证说明

用户工作台使用 Google 登录和持久化用户隔离。凭证、会话、接口与旧资源迁移见 [Google 认证说明](google-auth.md)，模型转发见 [CCR 接入说明](ccr-integration.md)。

## 页面组织

官网位于 `src/features/landing`，保留十种语言、已保存语言偏好、配置复制和剪贴板失败后的选择回退。

`/auth/sign-in` 提供统一 Google 登录注册入口；`/auth`、`/auth/sign-up` 及其子路径、`/sign-in` 和 `/sign-up` 及其子路径重定向至该入口。未配置认证时按钮禁用并提示，不模拟成功。

`/dashboard` 要求 Google 会话，未登录跳转登录页。未配置认证时显示不可用信息，未配置 CCR 时不提供公开演示。旧 `/dashboard/overview`、`/dashboard/profile`、`/api/users`、`/api/products` 路由返回 404。

## 用户工作台

每人管理一条 OpenAI Chat Completions 连接、一个模型和一枚桥接密钥。保存只保存配置，不代表已验证上游连通性。编辑时密钥留空保留服务端密钥；浏览器仅获得掩码。更换、停用密钥及删除连接需确认，删除同时撤销密钥。

工作台四栏分别展示连接、访问密钥、接入配置和用量。各栏共享状态，切换保留草稿；刷新从服务器重新加载。内部连接名保持稳定，显示名称可以修改，配置命令使用服务端返回的真实网关和模型选择器。

`demo-service.ts` 保留业务类型、表单校验和配置命令构建工具；公开页面不挂载免登录演示。

## 运行与验证

使用 Node.js 24 与 Bun。依赖安装、认证迁移和环境变量见 Google 认证文档。构建不执行数据库迁移。

执行 `bun run typecheck`、`bun run lint`、`bun run build`、`bun run test:e2e` 和 `bun run test:ccr`。公共页面套件验证未配置认证状态、路由兼容、语言、复制和响应式布局；独立 CCR 套件通过实际 Clerk SDK 验证签名会话与后端身份边界，并验证用户隔离、迁移和真实后端行为。托管 Google OAuth、Clerk UI、会话续期和远端退出仍需指定应用单独验收。
