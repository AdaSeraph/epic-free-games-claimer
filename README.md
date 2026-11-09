# 🎁 Epic Games 喜加一全自动领取助手 (Tampermonkey 油猴脚本)

一个专为 **Epic Games Store** 设计的限时免费游戏（喜加一）全自动探测与一键入库油猴脚本。

---

## ✨ 核心功能特性

1. **官方 API 精准探测 (`freeGamesPromotions`)**
   - 无需手动滚动页面查找限免卡片，直接请求 Epic 官方促销接口获取当周所有 `discountPercentage === 0` 的限时免费游戏。
   - **智能优先级排序**：自动区分“原价付费转限免 (`originalPrice > 0`)”与“常驻免费网游促销 (`originalPrice === 0`)”，优先为你领取真正的付费喜加一游戏。
2. **全链路自动下单入库**
   - 自动跳过 18+ 年龄限制遮罩（`Continue` / `继续`）。
   - 在商品详情页自动识别并点击免费的 **`Get` / `获取`** 按钮（绝不误点 `Buy Now` 付费购买按钮）。
   - 自动注入内嵌结算弹窗（`payment-website-pci.ol.epicgames.com` 及 `/purchase`），自动勾选协议并点击 **`Place Order` / `下订单`** 及二次确认弹窗（`I Agree` / `我同意`）。
3. **三重防卡死机制（告别在“已在库中”页面卡住）**
   - **全 DOM 识别秒跳**：不局限于 `<aside>`，全局扫描购买按钮与链接，一旦检测到 `In Library` / `已在库中` / `Owned` / `已拥有`，0.6 秒内立即跳往队列中的下一款限免游戏。
   - **已访问 Slug 黑名单**：使用 `sessionStorage` 记录本次已检查过的游戏 `Slug`，绝不重复进入同一款游戏造成死循环。
   - **8 秒倒计时硬兜底**：在详情页如果 8 秒内未出现 `Get` 按钮且未弹出结账窗口，自动跳过当前页面前往下一款。

---

## 🚀 安装与使用方法

### 1. 安装脚本管理器
在浏览器中安装以下任意一款扩展：
- [Tampermonkey (篡改猴)](https://www.tampermonkey.net/)（推荐 Chrome / Edge / Firefox）
- [Violentmonkey (暴力猴)](https://violentmonkey.github.io/)

### 2. 安装本脚本
- 点击一键安装：[👉 点此直接安装 `epic-free-games-claimer.user.js`](https://raw.githubusercontent.com/AdaSeraph/epic-free-games-claimer/main/epic-free-games-claimer.user.js)
- 或者打开本仓库中的 [`epic-free-games-claimer.user.js`](./epic-free-games-claimer.user.js) 文件，复制全部代码 → 打开 Tampermonkey 管理面板 → 点击 **「添加新脚本」** → 粘贴并按 `Ctrl + S` 保存。

### 3. 一键全自动领取
1. 打开 [Epic Games 商城](https://store.epicgames.com/?lang=en-US) 并确保已登录你的 Epic 账号。
2. 点击页面右下角悬浮面板中的 **「🚀 一键全自动领取本周限免」** 按钮。
3. 脚本将自动按队列依次打开本周限免游戏、自动跳过已在库中的游戏、自动点击 `Get` 与 `Place Order` 完成入库！

---

## 🛠️ 面板控制说明

| 按钮 | 说明 |
| :--- | :--- |
| **🚀 一键全自动领取本周限免** | 拉取最新官方限免列表，建立自动领取队列并开始全自动入库 |
| **⏭️ 立即跳过此页** | 手动跳过当前正在浏览的游戏页面，立即进入队列中的下一款 |
| **⏹️ 停止队列** | 立即清空并停止当前的自动跳转与领取队列 |

---

## 📄 License
MIT License
