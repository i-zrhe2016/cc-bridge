# 模板来源

项目基础已从 Kiranism/next-shadcn-dashboard-starter 切换至 [ixartz/SaaS-Boilerplate](https://github.com/ixartz/SaaS-Boilerplate)。

- 上游提交：`e3952a7ed5b0ef172ac4363c4644b8c334d1094b`
- 引入日期：2026-10-16
- 上游 MIT 许可证保留在根目录 `LICENSE`。
- 移入上游 shadcn 按钮及其变体、全局主题、居中容器、class helper、shadcn 配置与严格 TypeScript 配置，并采用上游 Antfu/React/Next.js ESLint 基础。
- 依赖版本取自该提交，仅保留页面和检查所需部分，以 `bun.lock` 锁定。

最初引入模板时为纯页面原型，未引入上游 Clerk、数据库、组织管理、监控、Storybook、示例后台及其环境配置；当前认证与持久化使用本项目的 Clerk 和 SQLite，见 [Google 认证说明](google-auth.md)。开发与构建脚本直接运行 Next.js。官网继续使用原有客户端 10 语言切换，不启用上游 locale 前缀路由。构建保留 Webpack 模式以适配当前运行目录。

登录页使用上游 `CenteredContainer`，从 dashboard 特性目录迁至 auth；当前登录组件改用官方 Clerk 统一登录注册组件与 @clerk/ui shadcn 主题。`Helpers` 仅保留无需服务配置的 `cn`。ESLint 未引入后台、Storybook 和 Tailwind 排序插件。

现有 CC Bridge 官网和品牌组件保留。旧模板后台、API、主题和组件库均已移除；此前 Kiranism MIT 声明另存于 `docs/licenses/Kiranism-MIT.txt`，用于保留历史衍生代码的版权声明。

## 工作台前端：Apptension SaaS Boilerplate

2026-10-16 起，工作台前端采用 [apptension/saas-boilerplate](https://github.com/apptension/saas-boilerplate)，锁定提交 `caa46d26e01f9cd2c29f0e67bb72ff073c755053`。这是实际源码适配，不是完整技术栈迁移。Next.js、官网、登录页和原有基础组件继续沿用现有项目；未引入 Django、React Router、Apollo、租户系统或 AWS 设施。

适配对应关系：

- 上游 `packages/webapp/src/shared/components/layout/layout.component.tsx` 的侧栏与主内容布局、`header/header.component.tsx` 的 sticky header，以及 `sidebar/sidebar.component.tsx` 的固定侧栏、品牌区、菜单项样式、激活状态和底部区域，精简并合入 `src/features/workspace/layout/layout.tsx`。
- 菜单项改为四个内存状态按钮；去除上游租户、权限、登录、国际化、主题切换及折叠依赖；侧栏宽度适配为 224px，700px 以下按本项目需求替换为顶部四项按钮，不采用上游移动抽屉。
- 上游 `packages/webapp-libs/webapp-core/src/components/ui/card.tsx` 的 Card 实现引入 `src/features/workspace/layout/card.tsx`，替换 helper 导入并适配 React 19 ref-as-prop，仅保留实际使用的 Card。
- Tailwind 样式沿用上游语义色与菜单类，适配现有 Tailwind v4 token。最初适配时产品内容、表单、密钥、配置和用量使用 CC Bridge 模拟业务逻辑；当前公开工作台要求真实 Google 会话，连接、密钥和用量对接 CCR，并按用户隔离。

上游完整 MIT 版权与许可文本保存在 `docs/licenses/Apptension-MIT.txt`，发布时随 licenses 目录一起保留；两个 Dockerfile 均复制根许可证与第三方 licenses，构建上下文已放行该目录。根目录 LICENSE 与历史许可证继续保留，反映各部分实际来源。

## 独立管理后台：Kiranism Next Shadcn Dashboard Starter

新增 `/admin` 采用 [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter)，锁定提交 `7705dfc0d13889e45c26a55ad5908da6a7a9a605`。现有项目基础、官网和用户工作台不迁移。

实际源码适配：

- 上游 `src/components/layout/app-sidebar.tsx` 的品牌区、分组导航、当前路由高亮与底部操作，以及 `header.tsx` 的 sticky header、侧栏触发器和路径信息适配至 `src/features/admin/layout/shell.tsx`。移除 Clerk 用户/组织、通知、搜索和多主题入口，移动端采用 Base UI Dialog 导航，桌面支持折叠。
- 上游 `src/components/layout/page-container.tsx` 的页面容器和标题/操作区适配至后台同名文件；上游 `src/components/ui/card.tsx` 移入 `src/features/admin/card.tsx`，仅调整 class helper 导入与项目格式。
- 上游 `src/components/ui/table/data-table.tsx` 与 `data-table-pagination.tsx` 的 TanStack 表头/行渲染、空状态、计数、页大小及翻页逻辑适配至 `src/features/admin/data-table.tsx`。改用原生语义表格与横向滚动，移除固定列、选择和批量操作；加入当前实例小规模资源的客户端搜索与排序。
- 上游 `src/features/overview/components/area-graph.tsx` 的 Recharts AreaChart、网格、坐标、点状填充与 Card 结构适配至 `src/features/admin/usage.tsx`，以真实请求和 Token 数据替换样例。

按需使用上游 Base UI、TanStack Query/Table/Form、Zod、Recharts 与 Tabler Icons，保留现有 Next.js、React、Tailwind、TypeScript 版本及 ESLint/构建方式；未在后台引入上游 Clerk 控件、计费、组织、Sentry、示例数据、全局主题或工具链。后台 Provider、组件与样式限定在后台路由，TanStack Form 负责编辑表单状态，Zod 在服务端校验输入。

Kiranism 完整 MIT 文本继续保存在 `docs/licenses/Kiranism-MIT.txt`，随既有镜像许可证目录发布。后台认证、CCR 适配、保护规则及部署说明见 [独立管理后台](admin.md)。
