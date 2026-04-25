# 香蕉大亨 · 技术文档

> MVP 阶段完整记录 · 更新于 2026-04-24

---

## 目录

1. [项目概览](#1-项目概览)
2. [目录结构](#2-目录结构)
3. [运行方式](#3-运行方式)
4. [游戏机制](#4-游戏机制)
5. [数据结构](#5-数据结构)
6. [文件详解](#6-文件详解)
7. [界面结构](#7-界面结构)
8. [存档系统](#8-存档系统)
9. [扩展指南](#9-扩展指南)

---

## 1. 项目概览

**香蕉大亨**是一款移动端优先的放置型点击游戏。玩家通过点击香蕉赚取货币，购买并合成猴子来实现自动产出，最终解锁更多空位和更高等级的猴子。

### 技术选型

| 项目 | 选择 | 原因 |
|------|------|------|
| 语言 | 纯 HTML + CSS + JavaScript | 零依赖，无需构建，直接用浏览器打开 |
| 框架 | 无 | 游戏逻辑简单，原生 DOM 足够 |
| 存储 | localStorage | 离线可用，无需后端 |
| 渲染 | requestAnimationFrame | 60fps 游戏循环，流畅动画 |

### 已完成的里程碑

| 里程碑 | 内容 |
|--------|------|
| 1 | 静态界面（顶栏、香蕉按钮、格子区、底部导航） |
| 2 | 点击系统（浮动飘字、暴击、香蕉动画） |
| 3 | 猴子格子（购买、解锁、价格递增） |
| 4 | 自动产出（每帧 tick、产速显示、猴子动画） |
| 5 | 拖拽合成（拖移空位 + 拖合同级、触控支持） |
| 6 | 本地存档（自动存档、读档、离线收益） |
| 7 | 集成打磨（设置弹窗、重置、成就统计、提示优化） |
| 后续优化 | 防误触选中、香蕉放大、点击飘香蕉、格子顺序解锁、香蕉样式系统 |

---

## 2. 目录结构

```
banana/
├── index.html          # 游戏主页面，所有 HTML 结构
├── style.css           # 全部样式
├── DOCUMENT.md         # 本文档
└── js/
    ├── config.js       # 静态配置表（数值、等级表、香蕉样式）
    ├── gameState.js    # 运行时状态对象
    ├── gameLogic.js    # 纯逻辑（修改状态，不碰 DOM）
    ├── ui.js           # UI 操作（读取状态，更新 DOM）
    ├── storage.js      # 存档系统（localStorage）
    └── main.js         # 入口：初始化、事件绑定、主循环
```

### 文件加载顺序（重要）

`index.html` 末尾按此顺序加载，顺序不能颠倒：

```
config.js → gameState.js → gameLogic.js → ui.js → storage.js → main.js
```

后一个文件依赖前一个文件中定义的变量。

---

## 3. 运行方式

### 本地运行

直接用浏览器打开 `index.html` 即可，不需要本地服务器。

### 部署到网络（让他人用手机访问）

**最简单方案 — Netlify 拖拽上传：**
1. 注册 [netlify.com](https://netlify.com)
2. 将 `banana` 文件夹整体拖入 Netlify 的 Sites 页面
3. 自动生成公开链接，手机浏览器直接访问

其他方案：GitHub Pages、Vercel、itch.io（游戏专用平台）。

---

## 4. 游戏机制

### 4.1 点击系统

每次点击香蕉触发一次点击事件：

```
点击收益 = baseClickValue + upgrades.clickPower
          = 1 + 0（MVP 阶段升级未开放）= 1

暴击判定：Math.random() < (0.05 + upgrades.critRate × 0.01)
暴击收益 = 点击收益 × 10
```

- 基础暴击率：**5%**
- 暴击倍率：**10×**
- 点击后飘出迷你香蕉（普通：小香蕉；暴击：大香蕉 + 金色光晕）
- 香蕉样式可解锁切换，见 [4.9 香蕉点击样式](#49-香蕉点击样式)

### 4.2 猴子产出

每帧（约 1/60 秒）调用一次 `gameTick(deltaSeconds)`：

```
每秒总产量 = Σ(每只猴子的等级产量) × (1 + upgrades.monkeySpeed × 0.1)
           = Σ(每只猴子的等级产量) × 1（MVP 阶段升级未开放）

每帧增加香蕉 = 总产量 × deltaSeconds
```

### 4.3 猴子等级表

| 等级 | 名称 | 表情 | 每秒产量 |
|------|------|------|----------|
| 1 | 小猴崽 | 🐵 | 0.5 |
| 2 | 调皮猴 | 🐒 | 1.2 |
| 3 | 勤劳猴 | 🦧 | 3.0 |
| 4 | 智慧猴 | 🐵 | 8.0 |
| 5 | 猴队长 | 🐒 | 22.0 |
| 6 | 猴将军 | 🦍 | 65.0 |
| 7 | 猴王 | 🦁 | 200.0 |
| 8 | 齐天大圣 | ⭐ | 650.0（MAX，不可再合成）|

### 4.4 猴子购买价格

价格随购买次数指数递增：

```
价格 = floor(100 × 2.5^已购买总数)

第1只：100
第2只：250
第3只：625
第4只：1,562
第5只：3,906
...
```

- 实际代码位于 `js/gameLogic.js` 的 `calculateMonkeyPrice()`
- 价格只和 `gameState.monkeysPurchased` 有关，和当前场上剩余猴子数量、等级无关
- 每次购买成功后才会执行 `monkeysPurchased++`

### 4.5 合成规则

- 将一只猴子**拖拽到同等级猴子**上触发合成
- 两只 Lv.N 猴子 → 一只 Lv.(N+1) 猴子
- Lv.8（MAX）不可合成
- 合成**不额外消耗香蕉**，成本就是被消耗掉的两只同级猴子
- 合成成功：记录 `totalMerges++`，播放金色闪光动画，显示 Toast

### 4.6 拖拽移动规则

- 将猴子拖拽到**已解锁的空格子**上触发移动
- 优先级：合成 > 移动（先尝试合成，失败再尝试移动）
- 拖拽中：同级目标高亮**金色**，可移动目标高亮**绿色**

### 4.7 空位解锁规则

空位必须**按顺序**依次解锁，不能跳过。界面上只展示**下一个**待解锁格子的价格，其余锁定格仅显示半透明 🔒，避免压迫感。

| 空位编号 | 解锁价格 |
|----------|----------|
| 0 | 免费（初始解锁）|
| 1 | 500 🍌 |
| 2 | 2,000 🍌 |
| 3 | 10,000 🍌 |
| 4 | 50,000 🍌 |
| 5 | 250,000 🍌 |
| 6 | 1,000,000 🍌 |
| 7 | 5,000,000 🍌 |
| 8 | 20,000,000 🍌 |
| 9 | 100,000,000 🍌 |

- 实际配置位于 `js/config.js` 的 `slotPrices`
- 只有“下一个待解锁空位”允许点击解锁，前端点击逻辑在 `main.js / handleSlotClick()`

### 4.7.1 所有消耗行为汇总（费用速查）

下表列出游戏中**所有消耗香蕉的操作**，以及当前数值来源：

| 操作 | 费用公式 | 配置入口 | 代码位置 |
|------|---------|---------|---------|
| 购买猴子 | `floor(100 × 2.5 ^ 已购买总数)` | `monkeyBasePrice` / `monkeyPriceGrowth` | `gameLogic.js` → `calculateMonkeyPrice()` |
| 解锁空位 | 固定查表，见 4.7 | `slotPrices[0..9]` | `gameLogic.js` → `unlockSlot()` |
| 合成猴子 | **不消耗香蕉**，仅消耗两只同级猴子 | — | `gameLogic.js` → `mergeMonkeys()` |
| 科技升级 | 暂未实装购买逻辑，升级项数据结构已预留 | — | `gameState.js` → `upgrades` |

---

### 4.7.2 猴子购买费用详表

公式：`价格 = floor(100 × 2.5 ^ monkeysPurchased)`

`monkeysPurchased` 是**累计购买次数**，每次成功购买后 +1，与当前场上猴子数量无关（即使猴子被合成消耗掉，计数也不回退）。

| 购买第 N 只 | 单只费用 🍌 | 累计总支出 🍌 | 约等于 |
|------------|-----------|------------|--------|
| 第 1 只 | 100 | 100 | — |
| 第 2 只 | 250 | 350 | — |
| 第 3 只 | 625 | 975 | — |
| 第 4 只 | 1,562 | 2,537 | 1.5K |
| 第 5 只 | 3,906 | 6,443 | 3.9K |
| 第 6 只 | 9,765 | 16,208 | 9.8K |
| 第 7 只 | 24,414 | 40,622 | 24K |
| 第 8 只 | 61,035 | 101,657 | 61K |
| 第 9 只 | 152,587 | 254,244 | 153K |
| 第 10 只 | 381,469 | 635,713 | 381K |

**调整方式：** 修改 `config.js` 中 `monkeyBasePrice`（基础价）或 `monkeyPriceGrowth`（增长系数）。
- 降低 `monkeyPriceGrowth`（如 1.8）可大幅缓解中后期价格飞涨
- 降低 `monkeyBasePrice`（如 50）可减轻早期入门门槛

---

### 4.7.3 空位解锁费用详表

| 空位编号 | 解锁费用 🍌 | 约等于 |
|---------|-----------|--------|
| 格 0 | 0（初始免费）| — |
| 格 1 | 500 | — |
| 格 2 | 2,000 | 2K |
| 格 3 | 10,000 | 10K |
| 格 4 | 50,000 | 50K |
| 格 5 | 250,000 | 250K |
| 格 6 | 1,000,000 | 1M |
| 格 7 | 5,000,000 | 5M |
| 格 8 | 20,000,000 | 20M |
| 格 9 | 100,000,000 | 100M |

**调整方式：** 直接修改 `config.js` 的 `slotPrices` 数组，索引对应格子编号。

---

### 4.7.4 合成成本分析（等效香蕉换算）

合成不直接花香蕉，但消耗的猴子本身有购买成本。从零开始养出一只各等级猴子，**至少需要购买的猴子数量**：

| 目标等级 | 最少需要买几只 Lv.1 | 等效最低购买成本 🍌（从头算） |
|---------|-------------------|--------------------------|
| Lv.1 | 1 只 | 100 |
| Lv.2 | 2 只 | 100 + 250 = 350 |
| Lv.3 | 4 只 | ≈ 975（累计第 1-4 只）|
| Lv.4 | 8 只 | 需要购买第 1-8 只，累计 ≈ 101,657 |
| Lv.5 | 16 只 | 超出 10 格容量，实际需要分批合成 |

> **注意**：格子只有 10 个，Lv.4 以上必须通过分批购买→合成来腾格子，实际成本更高。这是当前玩家感到疲惫的主要原因——达到高等级猴子需要大量重复购买-合成周期。

---

### 4.7.5 升级系统（预留，未实装）

`gameState.upgrades` 中的各项升级**当前没有购买界面和扣费逻辑**，数值只作为公式参数预留：

| 升级项 | 效果公式 | 代码引用位置 |
|--------|---------|------------|
| `clickPower` | 点击收益 = `1 + clickPower` | `gameLogic.js` → `getClickValue()` |
| `monkeySpeed` | 产量倍率 = `1 + monkeySpeed × 0.1` | `gameLogic.js` → `calculateTotalProduction()` |
| `critRate` | 暴击率 = `0.05 + critRate × 0.01` | `gameLogic.js` → `rollCrit()` |
| `offlineEarnings` | 离线上限 = `7200 + offlineEarnings × 3600` 秒 | `storage.js` → `calculateOfflineEarnings()` |
| `autoClick` | 自动点击（未接入任何逻辑）| — |

实装升级购买时，只需在 UI 层添加按钮，扣香蕉后执行 `gameState.upgrades.xxx++` 并调用 `saveGame()` 即可，公式无需改动。

### 4.8 离线收益

```
离线时长（秒）= (当前时间 - 上次登录时间) / 1000
有效时长     = min(离线时长, 7200 + upgrades.offlineEarnings × 3600)
              = min(离线时长, 7200)（MVP 阶段基础上限2小时）

离线收益     = floor(总产量 × 有效时长 × 0.5)  // 离线效率50%
```

离线时长不足 10 秒则忽略，不弹窗。

### 4.9 香蕉点击样式

点击飘出的迷你香蕉支持 4 种颜色风格，初始黄色免费，其余需购买解锁（后续版本实装解锁逻辑）。

| 样式 ID | 名称 | CSS 类 | 解锁价格 |
|---------|------|--------|----------|
| yellow | 黄香蕉 | —（无 filter） | 免费 |
| green  | 青香蕉 | `style-green` | 500 🍌 |
| red    | 红香蕉 | `style-red`   | 2,000 🍌 |
| blue   | 蓝香蕉 | `style-blue`  | 10,000 🍌 |

当前以 CSS `filter: hue-rotate()` 实现色彩差异，后期替换为真实图片素材后只需修改 `config.js` 的 `emoji` 字段并去掉对应 CSS filter 即可。

---

## 5. 数据结构

### 5.1 gameState（运行时）

```javascript
const gameState = {
  bananaCount:        0,       // 当前香蕉数（可为小数，显示时取整）
  totalBananasEarned: 0,       // 累计获得（用于成就统计）
  totalClicks:        0,       // 累计点击次数
  totalMerges:        0,       // 累计合成次数

  monkeys:     Array(10).fill(null),  // 每格：null 或 { level: 1-8, slotIndex: 0-9 }
  slotUnlocked:[true, ...9×false],    // 第0格默认解锁

  monkeysPurchased:    0,      // 累计购买猴子数（决定下一只价格）
  productionRate:      0,      // 当前每秒产量（仅用于显示，每帧更新）
  selectedBananaStyle: 0,      // 点击飘出的香蕉样式索引（对应 CONFIG.bananaStyles）

  upgrades: {
    clickPower:      0,        // 点击加成等级（+1点击/级）
    monkeySpeed:     0,        // 猴子速度等级（+10%产量/级）
    critRate:        0,        // 暴击率等级（+1%暴击/级）
    offlineEarnings: 0,        // 离线时长等级（+1小时上限/级）
    autoClick:       0,        // 自动点击等级（MVP 未实装）
  },

  lastLoginTime: Date.now(),   // 上次登录时间戳（毫秒）
};
```

### 5.2 存档格式（localStorage）

当前版本已切到账号存档模式，核心存档数据通过 Supabase 的 `game_saves` 表保存；本地 `localStorage` 主要用于会话和音频设置等轻量信息。

```json
{
  "bananaCount": 1234,
  "totalBananasEarned": 5678,
  "totalClicks": 99,
  "totalMerges": 5,
  "monkeys": [{"level":2,"slotIndex":0}, null, null, ...],
  "slotUnlocked": [true, true, false, ...],
  "monkeysPurchased": 3,
  "upgrades": {"clickPower":0,"monkeySpeed":0,...},
  "selectedBananaStyle": 0,
  "lastLoginTime": 1745000000000
}
```

### 5.3 拖拽状态（dragState）

```javascript
const dragState = {
  isDragging:    false,   // 是否正在拖拽
  sourceSlot:    -1,      // 被拖的格子索引
  ghost:         null,    // 跟随光标的 ghost DOM 元素
  lastTarget:    -1,      // 上一帧高亮的目标格子（用于清除样式）
  suppressClick: false,   // 拖拽结束后屏蔽下一次 click 事件
};
```

---

## 6. 文件详解

### config.js

只存放**不会在运行时改变的静态数据**。用 `Object.freeze()` 防止意外修改。

添加新等级或调整数值只需修改这一个文件。新增了 `bananaStyles` 数组，是点击飘出香蕉的样式表，每项包含 `id / name / emoji / cssClass / price`。

### gameState.js

定义全局变量 `gameState`，是游戏运行时的"唯一数据源"。所有逻辑和 UI 都从这里读取状态。

### gameLogic.js

**只修改 gameState，不碰 DOM**。

| 函数 | 作用 |
|------|------|
| `processBananaClick()` | 处理点击，返回 `{value, isCrit}` |
| `gameTick(delta)` | 每帧调用，增加香蕉，更新产速 |
| `calculateTotalProduction()` | 计算当前每秒总产量 |
| `calculateMonkeyPrice()` | 计算下一只猴子价格 |
| `buyMonkey(slotIndex)` | 购买猴子，返回成功/失败 |
| `unlockSlot(slotIndex)` | 解锁空位，返回成功/失败 |
| `mergeMonkeys(from, to)` | 合成，返回成功/失败 |
| `moveMonkey(from, to)` | 移动，返回成功/失败 |

### ui.js

**只读取 gameState，更新 DOM**。不修改游戏数据。

| 函数 | 作用 |
|------|------|
| `formatNumber(n)` | 格式化数字（K/M/B/T） |
| `formatRate(n)` | 格式化产速（小数位自适应） |
| `updateTopBar()` | 更新顶部香蕉数和产速显示 |
| `renderSlots(newSlot)` | 全量重建格子 DOM；只有第一个锁定格显示价格 |
| `updateSlotAffordability()` | 每帧轻量更新"可购买/可解锁"高亮；只对下一个锁定格判断 |
| `spawnFloatingBanana(x,y,isCrit)` | 点击后飘出迷你香蕉（依据 selectedBananaStyle） |
| `spawnMonkeyBanana(i)` | 生成猴子产出的 🍌 动画 |
| `playClickAnimation(isCrit)` | 播放香蕉点击动画 |
| `playMergeEffect(i)` | 播放合成闪光 |
| `showToast(msg)` | 显示底部提示条（1.8秒） |
| `showSaveIndicator()` | 显示存档指示（1.5秒） |
| `showOfflineEarnings(amount, ms)` | 弹出离线收益弹窗 |
| `showUnlockConfirm(i)` | 弹出解锁确认弹窗 |
| `updateBuyHint()` | 切换底部购买提示文案 |

### storage.js

| 函数 | 作用 |
|------|------|
| `saveGame()` | 序列化 gameState → localStorage，触发存档指示 |
| `loadGame()` | 读取 localStorage → gameState，返回是否有存档 |
| `calculateOfflineEarnings()` | 计算离线收益数量 |
| `resetGame()` | 清除存档，重置所有状态（含 selectedBananaStyle） |

### main.js

游戏入口，负责**把所有模块串联起来**。

**主循环 `gameLoop(timestamp)`：**
```
每帧执行：
  gameTick(delta)           → 香蕉增加
  updateTopBar()            → 顶部刷新
  updateSlotAffordability() → 格子高亮刷新
  每1.5秒：triggerMonkeyBananas() → 猴子动画
  每30秒：saveGame()        → 自动存档
```

**拖拽系统：**
- `startDrag` → `moveDrag` → `endDrag` 三段式
- `moveDrag` 中临时隐藏 ghost（`visibility:hidden`），用 `elementFromPoint` 检测下层格子，再恢复
- `endDrag` 中设置 `suppressClick=true`，80ms 后清除，防止拖拽误触点击

**初始化 `init()`：**
1. 读档 → 计算离线收益 → 弹窗提示
2. 注册 `contextmenu` 监听，阻止右键/长按系统菜单
3. 绑定所有事件（香蕉点击、格子点击、各弹窗按钮、底部导航）
4. 启动拖拽系统
5. 首次渲染界面
6. 启动 `requestAnimationFrame` 主循环

---

## 7. 界面结构

```
.game-wrapper（全屏容器，淡黄渐变背景；全局禁止文字选中）
├── header.top-bar
│   ├── 🍌 香蕉数  #banana-display
│   └── ⚡ 产速    #rate-display
│
├── main.click-area
│   ├── .banana-glow（背景光晕，240×240px）
│   └── .banana-float-wrapper（控制浮动动画）
│       └── button#main-banana
│           └── span.banana-emoji（控制点击动画，clamp(105px,28vw,145px)）
│
├── section.slots-section
│   ├── .slots-header（标题 + 说明）
│   ├── #slots-grid（10个格子，JS动态渲染）
│   └── #buy-hint-area（购买提示 / 合成提示）
│
├── #unlock-modal（解锁确认弹窗）
├── #settings-modal（设置弹窗）
├── #offline-modal（离线收益弹窗）
├── #toast（底部提示条）
├── #save-indicator（存档指示）
│
└── nav.bottom-nav（商店 / 升级 / 成就 / 设置）
```

### 格子的 CSS 状态类

| 类名 | 含义 |
|------|------|
| `slot-locked` | 未解锁的格子（非下一个仅显示半透明 🔒）|
| `slot-locked.can-unlock` | 下一个锁定格且香蕉足够解锁 |
| `slot-empty` | 已解锁但没有猴子 |
| `slot-empty.can-afford` | 空格且香蕉足够买猴子 |
| `slot-occupied` | 有猴子 |
| `slot-occupied.slot-maxlevel` | 有MAX级猴子（金边）|
| `slot-new` | 刚买入猴子（播放出现动画）|
| `slot-dragging` | 正在被拖拽的源格子（半透明）|
| `merge-target` | 合法合成目标（金色高亮）|
| `move-target` | 合法移动目标（绿色高亮）|
| `slot-merge-flash` | 合成成功瞬间（白色闪光）|

### 点击飘出香蕉的 CSS 类

| 类名 | 含义 |
|------|------|
| `floating-banana` | 普通点击香蕉（15px，向上漂移消失）|
| `floating-banana.crit` | 暴击香蕉（26px，更高弹出轨迹，金色光晕）|
| `floating-banana.style-green` | 青色 filter |
| `floating-banana.style-red` | 红色 filter |
| `floating-banana.style-blue` | 蓝色 filter |

---

## 8. 存档系统

### 触发时机

| 触发条件 | 说明 |
|----------|------|
| 每 30 秒自动 | 主循环中计时 |
| 购买猴子 | `handleSlotClick` 成功后 |
| 解锁空位 | `confirmUnlock` 成功后 |
| 拖拽合成/移动 | `endDrag` 成功后 |
| 关闭页面 | `window.beforeunload` |

### 读档时机

仅在 `init()` 初始化时读取一次。

### 版本控制

当前已不再使用旧版 `bananaTycoon_v1` 的纯本地单键存档方案。现版本由 `storage.js` 负责把规范化后的 `save_data` 写入 Supabase；若后续要做结构升级，建议通过 `normalizeSaveData()` 做兼容迁移，而不是直接依赖改键名让旧档失效。

---

## 9. 扩展指南

### 替换主香蕉图片

`index.html` 中 `.banana-emoji` 内是 `🍌` 表情，直接改为 `<img>` 标签即可：
```html
<!-- 改前 -->
<span class="banana-emoji">🍌</span>

<!-- 改后 -->
<span class="banana-emoji"><img src="assets/banana.png" style="width:100%;height:100%;object-fit:contain"></span>
```

### 替换猴子图片素材

1. 将图片放入 `assets/` 目录
2. 修改 `config.js` 中 `monkeyLevels` 的 `emoji` 字段为图片路径，如 `'assets/monkey_lv1.png'`
3. 在 `ui.js` 的 `renderSlots` 函数中，将 `${cfg.emoji}` 改为 `<img src="${cfg.emoji}" class="slot-img">`

### 替换 / 新增香蕉点击样式

1. 将彩色香蕉图片放入 `assets/` 目录
2. 修改 `config.js` 的 `bananaStyles` 数组：
   ```javascript
   { id: 'red', name: '红香蕉', emoji: 'assets/banana_red.png', cssClass: 'style-red', price: 2000 }
   ```
3. 在 `ui.js` 的 `spawnFloatingBanana` 中，将 `el.textContent = style.emoji` 改为根据路径决定用 `<img>` 还是文本渲染
4. 同时删除 `style.css` 中对应的 `hue-rotate` filter（真实图片不需要 filter）
5. 在商店 UI 中添加购买按钮，购买成功后设置 `gameState.selectedBananaStyle` 并调用 `saveGame()`

### 新增升级项

1. 在 `gameState.js` 的 `upgrades` 中新增字段
2. 在 `gameLogic.js` 中对应公式中加入该字段（如 `getClickValue` 中已使用 `upgrades.clickPower`）
3. 在 `storage.js` 的 `saveGame` / `loadGame` / `resetGame` 中包含该字段
4. 在 UI 层添加升级按钮，点击后调用逻辑函数并刷新显示

### 新增成就

1. 在 `config.js` 中新增成就列表（触发条件、奖励）
2. 在 `gameLogic.js` 的关键函数（点击、合成、购买）末尾检查成就条件
3. 触发时调用 `showToast` 或单独的成就弹窗

### 调整数值平衡

所有数值集中在 `config.js`，直接修改对应字段：
- 猴子产量：`monkeyLevels[n].production`
- 猴子价格增长率：`monkeyPriceGrowth`（当前 2.5）
- 暴击率/倍率：`critChance` / `critMultiplier`
- 空位解锁价格：`slotPrices`
- 香蕉样式解锁价格：`bananaStyles[n].price`

---

## 10. 2.x 续写记录

### 10.1 登录与账号

- 首次打开页面会强制进入注册/登录流程。
- 用户注册后，本地会保存账号与会话，再次打开会自动恢复登录状态。
- 当前实现仍是纯前端本地账号体系，数据保存在浏览器 `localStorage`，不依赖后端。

### 10.2 首页邮件区

- 邮件区已经从底部导航移出，改成首页中的独立区域。
- 邮件区和猴子农场同宽，摆在农场下方，避免和其他操作区混在一起。
- 邮件领取后会直接写回当前账号存档，刷新后状态保持。
- 邮件卡片已禁止长按复制和文字误选，移动端不容易误触。

### 10.3 GM 后台

- GM 后台已经从首页拆出，改为单独的 `gm.html` 页面访问。
- 首页不再提供 GM 入口，管理员需要直接打开后台页面。
- GM 登录账号为 `haohao`，密码为 `cxh44088`。
- GM 后台支持查看玩家香蕉持有量、猴子拥有情况、香蕉生产速率。
- GM 后台支持给玩家发送邮件和重置玩家进度。

### 10.4 图标与显示

- 首页猴子农场图标已恢复为猴子，不再显示猪图标。
- 首页邮件区和猴子农场已经对齐，避免布局割裂。
- 新增邮件区域后，原来那句“拖拽可移动 · 同级可合成”保留在农场标题中，不会和邮件区混淆。

### 10.5 版本说明

- 这次改动仍然基于本地存储实现，适合原型和内测。
- 如果后面要做正式上线，建议把账号、邮件和 GM 权限改成后端接口。
