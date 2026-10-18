# 部署

当前代码已接入 Google 认证及 SQLite，部署新版本前须按 [Google 认证说明](google-auth.md) 配置 HTTPS、凭证、持久化目录并执行迁移。以下服务器发布记录描述的是旧版本，并不表示新认证已上线。

真实 CCR 后端的安装、环境变量和 systemd 配置见 [CCR 接入说明](ccr-integration.md)。新版本要求完整认证和后端环境；历史生产记录保留于下文。

使用 Node.js 24。工作台仅用 Google 登录，管理后台使用独立运维口令。认证与 CCR 未配置时不回退演示。

## Vercel

当前 SQLite 与单机 CCR 部署不支持无持久盘的 Vercel Serverless。请使用持久化单机服务器或配置持久卷的容器。

## Docker

```bash
docker build -t cc-bridge .
docker run --rm -p 3000:3000 cc-bridge
```

也可使用 `docker build -f Dockerfile.bun -t cc-bridge .`。两个 Dockerfile 均设置 `BUILD_STANDALONE=true`，运行独立产物。以上仅启动镜像；启用工作台还需注入环境变量、挂载 SQLite 持久卷、单独执行认证迁移，并提供回环或私有网络 CCR。

## 普通服务器

```bash
bun install --frozen-lockfile
bun run build
bun run start
```

普通构建不启用 standalone，也不执行数据库迁移。

## 当前服务器部署（8354）

当前服务监听 `0.0.0.0:8354`，局域网访问地址为 `http://192.168.42.130:8354`。

- systemd 服务：`cc-bridge.service`，启用开机启动及失败自动重启。
- 发布目录：`/var/lib/cc-bridge/releases/`；`/var/lib/cc-bridge/current` 指向当前版本。
- 使用独立的 `cc-bridge` 系统用户运行；Node 路径为 `/opt/node-v24.11.0-linux-x64/bin/node`。
- 服务配置模板保存在 `deployment/cc-bridge.service`。

```bash
systemctl status cc-bridge
systemctl restart cc-bridge
journalctl -u cc-bridge -n 50 --no-pager
```

发布包包含 standalone 产物、`.next/static`、`public` 及许可证，保存在磁盘中，不依赖工作区内存盘的构建或依赖链接。当前工作区使用内存盘链接，因此本次在独立构建目录中将依赖实体化后生成发布包，避免 standalone 产物保留临时目录链接。

## 当前发布内容

2026-10-17 00:32（Asia/Shanghai）发布独立管理后台，采用 Kiranism Next Shadcn Dashboard Starter。访问 [管理后台](http://192.168.42.130:8354/admin)，使用后台专用口令登录；原 [用户工作台](http://192.168.42.130:8354/dashboard) 继续使用原管理口令。功能与边界见 [后台说明](admin.md)。

- 当前发布：`/var/lib/cc-bridge/releases/20261016T161920Z`，Node.js 24 standalone 产物，包含静态资源及第三方许可证，无指向工作区或内存盘的外部符号链接。
- 上一发布：`/var/lib/cc-bridge/releases/20261016T142624Z`；历史发布全部保留。
- 后台功能：多连接、多访问密钥、7/30 天用量统计、网关状态与启停/重启，支持 375/768/1440px 布局。
- 后台口令：`/etc/cc-bridge/operations-token`，root 所有、权限 600；对应运行环境变量为 `CC_BRIDGE_OPERATIONS_TOKEN`。与工作台口令及 CCR 管理令牌分别配置。
- 运行配置：`/etc/cc-bridge/workspace.env`；部署前环境备份：`/etc/cc-bridge/workspace.env.before-admin-20261016T161920Z`，均为 root 所有、权限 600。
- CCR 3.1.3：`/opt/cc-bridge-ccr`，服务 `cc-bridge-ccr.service`，数据目录 `/var/lib/cc-bridge-ccr`；本次发布不执行数据迁移。
- 正式服务由 `cc-bridge.service` 运行，监听 `0.0.0.0:8354`；CCR 端口仅绑定回环地址。
- 已完成临时端口与正式局域网地址的真实浏览器验收：后台页面和资源读取、独立登录及退出、会话隔离、Origin 拦截、原工作台登录、三种屏幕尺寸及无浏览器运行错误。发布验收不调用模型、不修改连接或访问密钥。
- 发布前通过类型检查、Lint、生产构建、17 项页面回归和 2 项真实 CCR 集成测试。
- 为腾出空间，仅清理可重新下载的 npm/浏览器缓存，并重新安装当前验收所需的浏览器；历史发布与 CCR 数据保留。

获取后台口令：

```bash
sudo cat /etc/cc-bridge/operations-token
```

## 回退当前发布

部署记录位于 `/etc/cc-bridge/deployment.json`。回退到新增后台之前的发布：

```bash
sudo ln -sfn /var/lib/cc-bridge/releases/20261016T142624Z /var/lib/cc-bridge/current
sudo systemctl restart cc-bridge
```

保留 CCR 数据目录和生产凭证文件。回退旧发布不会恢复后续在后台修改的 CCR 配置；如需恢复数据，应使用对应备份。关闭后台可移除 `CC_BRIDGE_OPERATIONS_TOKEN` 后重启服务。部署前的环境文件及发布记录已分别备份。
