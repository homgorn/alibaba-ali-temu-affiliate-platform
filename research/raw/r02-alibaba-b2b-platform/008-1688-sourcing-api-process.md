# 1688 Cross-Border Sourcing API Integration Process (2026 New Rules)

**Title:** 跨境电商如何接入1688官方寻源通接口？附接入流程
**URL:** https://jishuzhan.net/article/2041713496858099714
**Publisher:** 技术栈 (Technical Stack)
**Publish Date:** 2026-04-08T00:00:00.000Z
**Access Date:** 2026-10-08
**Source Type:** Technical tutorial (secondary source, but detailed)

## VERBATIM QUOTES (Original Language - Chinese)

### Eligibility Requirements (主体要求)
- "主体 ：必须是企业 / 个体工商户 （个人账号无法申请）"
- "业务：跨境电商、跨境 ERP、独立站、跨境供应链服务相关"
- "考核门槛（2026 新规）【GMV达不到可考虑接入第三方官方合作】"
  - "月成交额 ≥ 12 万元（通过寻源通 API 产生的确认订单）"
  - "调用效率 ≥ 0.5 元 / 次（总成交额 ÷ 总调用次数）"
  - "不达标会被限流 / 清退"

### Step 1: Register 1688 Open Platform Enterprise Developer
"用企业 1688 账号 登录 → 注册为企业开发者"
- "完成企业实名认证 ："
  - "营业执照"
  - "法人身份证"
  - "企业对公账户验证"

### Step 2: Create Application & Apply for 寻源通 Permission
"控制台 → 应用管理 → 创建应用"
- "应用名称：如「XX 跨境 ERP - 寻源通」"
- "应用类型：企业应用 / 跨境电商类"
- "应用场景：跨境选品 / 跨境供应链 / 跨境订单同步（必须写跨境相关）"
- "API 权限申请：进入 API 市场 → 跨境寻源通 → 勾选所需接口"
  - `crossBorder.product.search`（跨境商品搜索）
  - `crossBorder.product.get`（商品详情）
  - `crossBorder.supplier.get`（供应商资质）
  - `crossBorder.order.create`（跨境订单创建）
  - `crossBorder.order.list`（订单 / 物流）
- "提交审核（1-3 个工作日）"

### Step 3: OAuth 2.0 Authorization (获取 AccessToken)
"寻源通采用 OAuth 2.0 授权"

Authorization URL:
```
https://open.1688.com/auth/authorize.htm
?response_type=code
&client_id={appKey}
&redirect_uri={回调地址}
&state=自定义
&scope=crossBorder
```

Token Exchange:
```
POST https://open.1688.com/auth/token.htm
参数：
grant_type=authorization_code
client_id={appKey}
client_secret={appSecret}
code=上一步返回的code
redirect_uri={回调地址}
```

Returns: `access_token`、`refresh_token`、有效期（通常 7 天）

### Core Cross-Border APIs (跨境专用)
**Product Sourcing:**
- `crossBorder.product.search`：跨境商品搜索（关键词、价格、销量、认证、市场）
- `crossBorder.product.get`：商品详情（SKU、库存、价格、跨境属性、认证）

**Supplier:**
- `crossBorder.supplier.get`：供应商资质（是否工厂、诚信通、跨境能力）

**Order & Logistics:**
- `crossBorder.order.create`：创建跨境订单
- `crossBorder.order.list`：订单列表、状态、物流单号
- `crossBorder.logistics.get`：物流跟踪

### Common Rejection Reasons
- "审核被拒：原因：场景描述不清、非跨境业务、资质不全"
- "解决：明确写跨境电商 / ERP / 独立站 / 供应链用途"

### Rate Limits & Compliance
- "超过 QPS 限制（默认 50 次 / 秒）"
- "未达标月度考核（成交额 / 效率）"
- "无数据 / 权限不足：未申请对应接口权限、access_token 未带 crossBorder 范围"

### Benefits
- "✅ 精准选品 ：一键筛选支持跨境、带 CE/FDA、适配目标市场的货源"
- "✅ 自动同步：价格、库存、起订量实时同步到 ERP / 独立站"
- "✅ 合规保障 ：官方接口，无风控 / 封号风险"
- "✅ 跨境订单闭环：1688 下单 → 物流 → 售后全链路打通"

---

## CONFIDENCE: HIGH
This is a detailed technical guide from 2026-04-08 with specific "2026 new rules" including GMV requirements (¥120k/month via API) and call efficiency (¥0.5/call). Critical finding: **Enterprise entity required (营业执照, 法人身份证, 企业对公账户)** - individual developers CANNOT apply. Monthly performance review with throttling/removal for non-compliance. The `crossBorder.*` API namespace is distinct from general 1688 APIs. QPS default 50/sec. Accessed 2026-10-08.