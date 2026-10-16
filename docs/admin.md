# 独立管理后台

`/admin` 使用 Kiranism Next Shadcn Dashboard Starter 的布局、数据表格、卡片和图表适配代码，真实调用 CCR 3.1.3。官网、模拟 Google 登录和 `/dashboard` 继续保留。

## 启用

先按 [CCR 接入说明](ccr-integration.md) 配置后端，再在私有运行环境文件中增加：

```dotenv
CC_BRIDGE_OPERATIONS_TOKEN=<独立随机值，至少32字符>
```

可用 `openssl rand -hex 32` 生成。该值必须与 `CC_BRIDGE_ADMIN_TOKEN`（原工作台口令）及 `CCR_WEB_AUTH_TOKEN` 不同。后台读取运行时环境，无需把口令传入构建。重启 Next.js 后访问 `/admin/login`。缺少独立口令、口令过短或与其他口令相同时，后台保持关闭，API 返回 503。

后台使用独立签名 Cookie，有效期 8 小时，HttpOnly、SameSite=Strict；公开地址为 HTTPS 时启用 Secure。Cookie 路径为 `/`，以同时保护后台页面和 API；签名加入后台专用上下文，不能替代工作台会话。写操作检查 `CC_BRIDGE_PUBLIC_URL` 对应的 Origin。

## 页面

- `/admin`：连接数、有效密钥数、网关状态及七天实际用量。
- `/admin/providers`：多连接列表、搜索、排序、分页、状态筛选、新增、编辑、启停和删除。首期新增/编辑使用 OpenAI Chat Completions；模型每行一个。连接创建后名称固定。编辑 API Key 留空保留原密钥，API 不返回上游密钥。
- `/admin/keys`：实例访问密钥列表、新建、更换、撤销和删除，支持可选有效期。新建和更换结果中展示完整密钥，关闭后列表只显示掩码；新建结果不会进入查询缓存或浏览器存储。
- `/admin/usage`：全局或单连接的 7/30 天请求量、输入/输出 Token 汇总及趋势。沿用 CCR 时间口径，不含代理流量，不展示费用或请求正文。
- `/admin/system`：管理服务可达性、网关状态、启动/停止/重启。概览和系统状态每 30 秒刷新，页面隐藏时暂停后台轮询。

停止、重启、删除、更换和撤销需要确认。保存连接沿用 CCR 原生应用行为，可能启动或重载网关；停止状态不会被当作持久化维护模式。

## 资源及并发边界

后台管理当前 CCR 实例全部连接和客户端密钥。工作台专用连接 `cc-bridge-workspace` 可编辑，保留单模型结构，不能在后台停用或删除；专用密钥 `cc-bridge-workspace-key` 可更换、撤销，不能在后台删除。工作台正常生成密钥后，两端操作会看到同一资源状态。其他协议连接保留原始配置，首期不提供协议专属编辑器。

客户端密钥拥有实例级模型访问权限，不提供用户隔离、模型授权或额度配置。密钥撤销通过 CCR 原生过期时间生效；更换已失效密钥会重新启用并取消过期时间，仍有效的密钥保留有效期。最后一枚密钥禁止删除，请使用撤销，避免 CCR 在空列表时自动生成默认密钥。

后台与工作台共用当前 Node.js 进程中的配置写入队列；后台使用不透明版本标识拒绝过期编辑，连接保存还保留 CCR `configRevision`，冲突返回 409。表单冲突后应关闭表单、刷新列表并重新编辑。非目标资源和 CCR 支持但本界面未编辑的配置字段保留；CCR 自身仍会规范化配置。

CCR 的 `saveApiKeys` 不提供原子版本校验，因此不能保证与原生 CCR 界面或其他进程同时改写密钥时无覆盖。当前方案要求单个 Next.js 服务实例，并将 CC Bridge 作为统一写入口。不提供任意 RPC、系统命令、运行时端口修改或原始配置导出。

## 验证与发布

```bash
bun run typecheck
bun run lint
bun run build
bun run test:e2e
npm ci --prefix deployment/ccr-runtime
bun run test:ccr
```

集成测试使用独立 CCR 数据目录和模拟 OpenAI 上游，验证登录隔离、Origin、版本冲突、保护规则、连接持久化、实际密钥更换和撤销、用量、网关控制及 375/768/1440px 布局；不调用收费模型，不读取生产口令。

按 [现有部署流程](deployment.md) 构建和发布，增加后台环境变量后重启服务。首次启用后检查独立登录、连接/密钥列表、系统状态与用户工作台。回退恢复上一发布并重启 Next.js，保留 CCR 数据及私有配置；关闭后台可移除 `CC_BRIDGE_OPERATIONS_TOKEN` 后重启。已保存的 CCR 配置不会随前端回退自动恢复，需要使用部署前备份单独恢复。
