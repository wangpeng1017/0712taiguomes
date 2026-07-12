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
| L1 类型检查 | `npx tsc --noEmit` | 类型零报错 |
| L2 构建 | `npm run build` | 生产构建通过 |
| L3 业务冒烟 | 人工走一遍：新建工单→下达→注塑/冲压开工报工→物料入库→模具保养→批次追溯→生产日报 | 核心闭环无报错，数据联动正确（模具寿命/工单进度/日报汇总实时更新） |

- UI 改动验证方式: 人工冒烟清单（本项目暂无 Playwright E2E，Demo 阶段优先级 P2）

## 测试环境
- 部署方式: 🔴 TODO — 王老师说"最终作为测试服务部署在阿里云上"，具体地址/服务器/部署方式待补
- 地址: 🔴 TODO
- 数据库: 🔴 TODO（本地开发用 SQLite 文件库；阿里云测试环境预期用 MySQL，部署前需把 `prisma/schema.prisma` 的 `datasource.provider` 由 `sqlite` 切回 `mysql`，并执行 `npx prisma migrate deploy` + `npx tsx prisma/seed.ts`）
- 冒烟方式: 访问首页仪表盘 + 走一遍核心业务闭环（同上）

## 生产环境
- 🔴 一期为测试服务演示阶段，暂无生产环境规划

## GitHub
- 远程/分支: 🔴 TODO（王老师如需推送远程仓库，先问清楚放哪个 GitHub 账号/组织）
- 排除目录: `node_modules/` `.next/` `prisma/dev.db`（SQLite 本地库文件，不入库）

## 文档同步清单
- 功能变更 → `docs/PRD.md`（状态 + 变更历史）
- 数据模型变更 → `prisma/schema.prisma` 改字段后必须同步 `docs/PRD.md` 数据模型章节

## 项目专属铁律（ship 开局一并 Read）
- 见项目根 `CLAUDE.md`「项目专属铁律」章节：批次号生成规则/数量闭环公式集中实现、模具状态机不可因 demo 简化跳过、状态字段用 String 不用 enum
