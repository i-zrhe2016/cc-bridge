# 部署

真实 CCR 后端的安装、环境变量和 systemd 配置见 [CCR 接入说明](ccr-integration.md)。以下无环境变量运行方式为演示模式；当前服务器已启用真实后端模式。

使用 Node.js 24。页面无需认证密钥、数据库或监控环境变量，部署后登录仍为本地模拟。

## Vercel

连接仓库，安装命令使用 `bun install --frozen-lockfile`，构建命令使用 `bun run build`。无需配置 Clerk 或数据库。

## Docker

```bash
docker build -t cc-bridge .
docker run --rm -p 3000:3000 cc-bridge
```

也可使用 `docker build -f Dockerfile.bun -t cc-bridge .`。两个 Dockerfile 均设置 `BUILD_STANDALONE=true`，运行独立产物。

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

2026-10-16 22:26（Asia/Shanghai）恢复原版居中布局，桌面主内容保持最大 1000px 宽度、左右 32px 留白；手机保留 16px 留白。真实 CCR 工作台继续使用「我的 GPT、访问密钥、使用教程、使用统计」四栏。访问 `http://192.168.42.130:8354/dashboard`，使用管理口令进入；原 Google 登录仍为演示。

- 当前发布：`/var/lib/cc-bridge/releases/20261016T142624Z`；构建使用 Node.js 24 和 standalone，发布包没有指向工作区或内存盘的外部符号链接。
- 上一发布：`/var/lib/cc-bridge/releases/20261016T141606Z`，所有旧发布保留。
- CCR 3.1.3：`/opt/cc-bridge-ccr`，独立用户 `cc-bridge-ccr`，服务 `cc-bridge-ccr.service` 已启用开机启动；数据持久化到 `/var/lib/cc-bridge-ccr`。
- 生产配置：`/etc/cc-bridge/workspace.env` 与 `/etc/cc-bridge/ccr.env`，均为 root 所有、权限 600。工作台管理口令单独保存在 `/etc/cc-bridge/admin-token`，可在服务器执行 `sudo cat /etc/cc-bridge/admin-token` 获取。
- 当前未配置 GPT 上游，因此 CCR 管理服务正常运行，模型网关处于等待配置状态；在工作台保存有效上游连接后自动启动。内部管理端口 3458 仅监听 `127.0.0.1`，3456、3457 尚未监听。
- 已通过线上浏览器管理登录、刷新会话保持、退出、Origin 拦截、375/1440px 布局和内部端口不可从局域网访问的检查；未使用真实 GPT 密钥或产生模型费用。

## 回退当前发布

部署记录保存在 `/etc/cc-bridge/deployment.json`。回退到本次布局调整前、已接入 CCR 的工作台：

```bash
sudo ln -sfn /var/lib/cc-bridge/releases/20261016T141606Z /var/lib/cc-bridge/current
sudo systemctl restart cc-bridge
```

保留 CCR 数据目录和生产凭证文件，回退不删除已保存的数据。
