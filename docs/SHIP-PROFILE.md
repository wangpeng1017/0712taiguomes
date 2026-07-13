# SHIP-PROFILE — 泰国工厂轻量MES 发版档案

> 本档案是 `/ship` 通用流程的项目接口：ship 的每一步执行**这里声明的命令**。
> 🔴 首次部署前必须与王老师核对补全下方 TODO 项，不允许 AI 自行猜测阿里云地址/凭证。

## 构建与静态检查
- 类型检查: `npx tsc --noEmit`
- Lint: `npm run lint`（`next lint`，ESLint 8 传统配置）
- 构建: `npm run build`

## 测试矩阵（全绿定义，任一失败禁止发版）
| 层 | 命令 | 覆盖内容 |
|----|------|---------|
| L0 规则测试 | `npm test` | 数量公式、模次、模具预警、工单状态机 |
| L1 类型检查 | `npx tsc --noEmit` | 类型零报错 |
| L2 构建 | `npm run build` | 生产构建通过 |
| L3 业务冒烟 | 人工走一遍：新建工单→下达→注塑/冲压开工报工→物料入库→模具保养→批次追溯→生产日报 | 核心闭环无报错，数据联动正确（模具寿命/工单进度/日报汇总实时更新） |

- UI 改动验证方式: 人工冒烟清单（本项目暂无 Playwright E2E，Demo 阶段优先级 P2）

## 测试环境
- 部署方式: 本地 `git archive` 生成发布包，SCP 到 `root@8.130.182.148` 后解压到 `/root/taiguo-mes`，执行 `scripts/deploy-test.sh`
- 地址: `http://8.130.182.148/taiguo-mes/dashboard`
- 应用: PM2 `taiguo-mes`，仅监听 `127.0.0.1:3004`；Nginx `/taiguo-mes` 反向代理
- 数据库: MySQL `127.0.0.1:3308/taiguo_mes_test`，独立账号；schema 为 `prisma/mysql/schema.prisma`
- 首次初始化: `npm run db:mysql:generate && npm run db:mysql:migrate && npm run db:seed`
- 服务器限制: 无 Git、dnf、yum；禁止在服务器直接安装或猜测包管理器
- 冒烟方式: 访问首页仪表盘 + 走一遍核心业务闭环（同上）

### 发布命令

```bash
git archive --format=tar.gz --output=/tmp/taiguo-mes-release.tar.gz HEAD
scp /tmp/taiguo-mes-release.tar.gz root@8.130.182.148:/tmp/
ssh root@8.130.182.148 'mkdir -p /root/taiguo-mes && tar -xzf /tmp/taiguo-mes-release.tar.gz -C /root/taiguo-mes && cd /root/taiguo-mes && npm run deploy:test'
```

Nginx 配置位置：`/etc/nginx/conf.d/dingdan.conf`，修改前备份，修改后必须 `nginx -t && nginx -s reload`。

### 安全边界

- 2026-07-13 发现 root 级恶意程序并完成在线隔离，详见 `docs/SECURITY-INCIDENT-20260713.md`
- SSH root 密钥已轮换为独立 Ed25519 密钥，密码登录关闭
- 在线清理不能替代系统重装；该 ECS 应安排重建，当前 MES 仅作为隔离测试服务使用

## 生产环境
- 🔴 一期为测试服务演示阶段，暂无生产环境规划

## GitHub
- 远程/分支: `https://github.com/wangpeng1017/0712taiguomes.git` / `main`
- 排除目录: `node_modules/` `.next/` `prisma/dev.db`（SQLite 本地库文件，不入库）

## 文档同步清单
- 功能变更 → `docs/PRD.md`（状态 + 变更历史）
- 数据模型变更 → `prisma/schema.prisma` 改字段后必须同步 `docs/PRD.md` 数据模型章节

## 项目专属铁律（ship 开局一并 Read）
- 见项目根 `CLAUDE.md`「项目专属铁律」章节：批次号生成规则/数量闭环公式集中实现、模具状态机不可因 demo 简化跳过、状态字段用 String 不用 enum
