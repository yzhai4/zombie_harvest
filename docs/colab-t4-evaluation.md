# Google Colab T4 评估与运行方案

## 结论

Colab T4 适合作为**可恢复的批量实验节点**，不适合作为游戏的持续在线后端、稳定 API 服务或唯一生产环境。

T4 通常提供 16 GB GDDR6 显存；官方 Colab FAQ 明确说明 GPU 类型、配额、空闲超时和最长 VM 生命周期会动态变化，免费运行时最长通常为 12 小时，Colab Pro+ 在资源充足时可连续执行更长时间，但仍受配额和回收影响。见 [Colab FAQ](https://research.google.com/colaboratory/faq.html) 和 [NVIDIA T4 规格](https://www.nvidia.com/content/dam/en-zz/Solutions/Data-Center/tesla-t4/t4-tensor-core-datasheet-951643.pdf)。

## 适合的任务

- headless 游戏副本批量运行；
- 规则 AI、Utility/GOAP AI 和受限 LLM 首脑的对比实验；
- 小型本地模型推理、4-bit 量化模型实验和 LoRA/PEFT 小规模训练；
- 事件链参数搜索、Bayesian Optimization、CMA-ES 和多 seed 评测；
- 生成 JSON/CSV/Markdown 结果和回放摘要；
- 使用 [Colab CLI](https://developers.googleblog.com/introducing-the-google-colab-cli/) 从本地脚本提交可恢复任务。

## 不适合的任务

- 让玩家实时访问的常驻游戏服务器；
- 依赖稳定公网 IP、长连接、WebSocket 或 SSH 常驻进程；
- 单次运行超过 12 小时且没有 checkpoint；
- 把 notebook 内存、`/content` 临时盘或挂载 Drive 当作唯一数据源；
- 高频调用远程 LLM API 并将 Colab 当作生产代理。

Colab 官方优先交互式计算，资源限制动态且未公开固定值；不要使用 keep-alive、端口转发或绕过 UI 的方式对抗回收和配额。需要稳定资源时使用 GCP Marketplace 专用 VM、Colab Enterprise 或受控本地运行时。[官方本地/远程运行时说明](https://research.google.com/colaboratory/local-runtimes.html)

## 推荐分层

```text
本地开发机
    -> Git/配置/游戏 UI
轻量云服务器（4 核 / 4 GB / 60 GB / 5 Mbps）
    -> HTTPS API、实验队列、manifest、结果索引、轻量 dashboard
Colab T4
    -> 拉取指定 commit 或 manifest
    -> 运行 N episodes / GPU 推理
    -> 分片保存 checkpoint / JSONL / metrics
云服务器或对象存储
    -> 保存摘要、校验值和最近运行物
本地分析
    -> 汇总、可视化、人工审查、更新 EXP/PROB 记录
```

## 轻量云服务器的定位

这台服务器很有帮助，但应承担**控制面和持久化**，不要承担大模型推理。它适合：

- 运行 Git webhook、实验队列和任务状态 API；
- 保存 experiment manifest、run manifest、JSONL 摘要、指标和 replay hash；
- 运行 CPU 规则回归、少量 headless 副本和结果聚合；
- 托管静态试玩页、实验 dashboard 或内部报告；
- 作为 Colab 的任务领取和结果回传端点。

它不适合：

- 本地运行 7B 以上 LLM；4GB 内存和无 GPU 会使推理很慢；
- 承担高并发玩家连接、实时 WebSocket 或大型资源分发；
- 保存完整模型权重、长期原始日志和所有 Docker 镜像；
- 作为 Colab 的常驻 SSH 控制器或反向隧道服务。

推荐让 Colab 通过 HTTPS **轮询任务**或使用 Colab CLI 获取 manifest，完成后上传压缩结果。不要依赖 Colab 入站端口、常驻 SSH 或 keep-alive。5Mbps 足以传输 manifest、指标和压缩后的 replay 摘要，但不适合频繁同步模型权重和大型视频。

建议服务器保留最近 20–50 次运行的摘要，原始大文件上传对象存储或按实验归档；60GB 系统盘设置 70% 使用率告警。公网服务只开放 HTTPS 和密钥认证的 SSH，API key 放在环境变量或 secret 文件中。

每个任务必须支持：

- `--manifest <path>`；
- `--seed-start`、`--seed-count`；
- `--checkpoint-dir`；
- `--max-episodes` 和时间预算；
- 中断后从最近 checkpoint 继续；
- 结束时写 `run-manifest.json`，记录 commit、模型、依赖、GPU、开始结束时间和结果路径。

## 运行策略

1. 默认 CPU 运行规则回归；只有模型推理或训练实际使用 GPU 时才申请 T4。
2. 将 1000 局实验拆成 20–50 局一片，片间上传结果。
3. 将模型缓存、依赖锁定和数据清单写入 manifest；不要依赖 notebook 上一次状态。
4. 采用温度 0、固定 prompt 版本和记录模型输出的 deterministic decision-replay 模式。
5. Colab 被回收时只重跑未完成分片，不覆盖已有结果。
6. 需要稳定服务时迁移到 GCP Compute Engine、Colab Enterprise 或受控本地运行时；Colab 只作为实验控制面。

## 可行性判断

对于当前项目，**轻量云服务器 + Colab T4** 足以支撑 v86–v89 的 headless 事件链、首脑规划器和批量评测：服务器负责可靠的队列、状态和结果，Colab 负责可回收的 GPU 计算。游戏主循环仍应 CPU 可运行，GPU 只是加速路径。若未来需要玩家实时访问或稳定 API，再迁移到 GCP 专用 VM、Colab Enterprise 或其他受控服务。

