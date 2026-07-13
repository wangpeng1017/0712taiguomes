# CLAUDE.md — 泰国工厂轻量MES（项目专属）

> L2 项目专属规则。L0 全局规则见 `~/.claude/CLAUDE.md`；L1 类型规则见
> `~/.claude/profiles/web-nextjs.md` + `~/.claude/profiles/industrial-iot.md`（本项目双重叠加，参照 LIMS 先例）。
> 本文件只写项目专属内容，不复制全局规则。

## 项目一句话

泰国工厂汽车电子结构件（注塑件+冲压钣金件，线束预留）轻量 MES 一期：工单驱动生产、小批次追溯、模具寿命关联保养、日报自动汇总。

## 技术栈（版本已按"降一档用稳定版"原则锁定，禁止随手 `npm install xxx@latest` 升级）

| 层 | 选型 | 说明 |
|----|------|------|
| 前端/后端 | Next.js 14.2.35（App Router，前后端同仓） | 未用 15/16：16 把 async params/Turbopack-by-default/middleware→proxy 全部作为破坏性变更引入，15 生态适配期踩过坑 |
| UI | Ant Design 5.29.x + React 18.3（`^18`） | 未用 antd 6 / React 19：生态适配不足 |
| ORM/DB | Prisma 6.19.x + MySQL | 未用 Prisma 7：把 `datasource.url` 移出 schema，破坏性变更踩过坑；本地开发用 SQLite 文件库零依赖，测试/生产用 MySQL |
| 语言 | TypeScript 5 |

## 部署

- 测试环境：`http://8.130.182.148/taiguo-mes/dashboard`
- 服务器目录：`/root/taiguo-mes`；PM2：`taiguo-mes`；应用仅监听 `127.0.0.1:3004`
- 数据库：共享 MySQL 实例 `127.0.0.1:3308` 中的独立库 `taiguo_mes_test`，使用独立最小权限账号
- 双数据库结构：本地继续使用 `prisma/schema.prisma`（SQLite）；测试环境使用 `prisma/mysql/schema.prisma` + 独立 MySQL migrations
- 服务器没有 Git/系统包管理器，发版采用本地 `git archive` → SCP → 解压 → `scripts/deploy-test.sh`
- 完整 SOP 与安全边界见 `docs/SHIP-PROFILE.md`

## 必读文件指针

- `docs/PRD.md` — 需求唯一权威，源自王老师提供的《泰国工厂轻量MES一期建设 SPEC v0.1》PDF，功能状态 🔴/🟡/🟢/⚫
- `PROJECT_INDEX.md` — 项目地图（技术栈/业务链路/目录结构/功能域对照）
- `docs/SHIP-PROFILE.md` — `/ship` 发版档案（部署命令待补）
- `prisma/schema.prisma` — 数据模型唯一权威，改字段前必须先 Read，禁止凭记忆猜字段名

## 项目专属铁律

- **批次号生成规则固定**：`{INJ|STP}-{YYYYMMDD}-{D|N}-{设备编号}-{当日流水号3位}`，实现只此一处（`src/lib/batch-no.ts`），禁止在多处重复拼接
- **数量闭环公式不可散落重写**：总生产/实际消耗/材料利用率/不良率/冲次等公式集中在 `src/lib/production-calc.ts`，UI 层与 Server Action 只读不重复算
- **模具状态机是硬规则**：维修中/停用/报废 → 禁止开工；达到 100% 设计寿命 → 必须二次确认才能继续生产（SPEC §6.7.3/§8.5），这条不能因为"demo 简化"而跳过
- **演示数据的锚点日期**：seed 数据以固定日期（非 `new Date()`）为"今天"，避免部署后因真实日期漂移导致仪表盘/日报空白；当前锚点见 `prisma/seed.ts` 顶部 `TODAY` 常量
- **状态字段用 String 不用 Prisma enum**：兼容本地 SQLite / 生产 MySQL 双 provider 切换，取值范围在 `src/lib/constants.ts` 集中维护
