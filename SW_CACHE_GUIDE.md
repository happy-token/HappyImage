# 图库资源缓存和Service Worker实现指南

## 概述

此实现为 happyimage-web 提供了强缓存策略和自动更新机制：

### 📦 缓存策略

| 资源类型 | 缓存策略 | 说明 |
|---------|---------|------|
| `/seed-gallery/*` | 1年不可变缓存 | 使用内容寻址命名，文件变化时名称变化 |
| `/_next/static/*` | 1年不可变缓存 | Next.js 哈希输出，永不改变 |
| `/sw.js` | 0秒+必须重新验证 | 每次都获取最新版本 |
| `/icon.png` 等 | 7天+必须重新验证 | 偶尔更新的静态资源 |
| HTML页面 | 0秒+必须重新验证 | 总是获取最新版本 |

### 🔄 Service Worker 缓存机制

Service Worker 实现了三级缓存策略：

1. **Gallery 资源** (Cache First)
   - 优先从缓存提供
   - 缓存未命中时从网络获取
   - 自动缓存成功的响应

2. **Next.js 静态资源** (Cache First)
   - 同样的 Cache First 策略
   - 保证首次加载后离线可用

3. **其他资源** (Network First)
   - 优先从网络获取
   - 网络失败时使用缓存
   - 保证获得最新内容

## 🚀 功能特性

### ✅ 已实现

- [x] 强缓存配置（1年不可变）
- [x] Service Worker 自动注册
- [x] 缓存自动清理（清理过期版本）
- [x] 自动更新检测（每小时）
- [x] 用户通知更新可用
- [x] 一键刷新应用
- [x] 离线支持
- [x] 调试工具

### 📊 缓存分类

Service Worker 使用版本化缓存名称：
- `happy-assets-1.0.0` - 通用静态资源
- `happy-gallery-1.0.0` - 图库资源
- `happy-pages-1.0.0` - 页面内容

更新 Service Worker 版本时（修改 `CACHE_VERSION`），会自动清理旧缓存。

## 🛠️ 使用方式

### 自动（无需配置）

Service Worker 在应用加载时自动注册和管理缓存。用户会看到：

1. **首次访问**：资源被缓存
2. **有更新可用**：收到通知 "应用已更新，点击这里刷新"
3. **点击刷新**：加载最新版本

### 手动管理（调试用）

在浏览器控制台中：

```javascript
// 查看缓存统计
swDebug.getCacheStatus()

// 清除所有缓存
swDebug.clearCache()

// 手动检查更新
swDebug.checkForUpdates()

// 查看当前状态
console.log(swDebug.state)

// 查看 Service Worker 注册信息
console.log(swDebug.registration)
```

## 🔧 配置

### 更新版本号

如果需要强制清理缓存，更新 `/public/sw.js` 中的版本号：

```javascript
const CACHE_VERSION = '1.0.0'  // 改为 '1.0.1'
```

新版本会：
- 自动注册为活跃 Service Worker
- 清理所有旧版本的缓存
- 获取最新资源

### 调整缓存策略

编辑 `/public/sw.js` 中的 `fetch` 事件处理器：

```javascript
// 修改 Cache First 资源列表
if (url.pathname.startsWith('/your-path/')) {
  // cache first strategy
}

// 修改 Network First 资源列表
if (url.pathname.startsWith('/api/')) {
  // network first strategy
}
```

### 修改更新检查间隔

在 `/src/components/service-worker-init.tsx` 中：

```typescript
// 改为每30分钟检查一次
updateCheckIntervalRef.current = setInterval(() => {
  checkForUpdates()
}, 30 * 60 * 1000)  // 30 minutes
```

## 📈 性能优势

### 带宽节省
- Gallery 资源：首次加载后，重复访问 **0字节**
- Next.js 资源：1年缓存，除非重新部署

### 加载速度
- 缓存命中：从磁盘加载，**<100ms**
- 首次加载：同时缓存后续资源

### 离线支持
- 访问过的页面和资源可离线查看
- API 请求失败时显示离线提示

## 🐛 调试

### 查看 Service Worker 状态

1. 打开 DevTools → Application 标签
2. 查看 Service Workers 部分
3. 确认 Service Worker 已注册和激活

### 检查缓存

DevTools → Application → Cache Storage

应该看到：
- `happy-assets-1.0.0`
- `happy-gallery-1.0.0`
- `happy-pages-1.0.0`

### 启用详细日志

Service Worker 在浏览器控制台输出日志，搜索 `[SW]` 前缀

### 强制更新

1. DevTools → Network 标签
2. 勾选 "Disable cache"
3. 刷新页面（Ctrl+Shift+R）

或在控制台：

```javascript
// 清除所有缓存并重新加载
swDebug.clearCache().then(() => location.reload())
```

## ⚠️ 注意事项

1. **Service Worker 更新延迟**
   - 新的 Service Worker 在下次访问时才会注册
   - 更新通知会提示用户
   - 用户可选择立即刷新

2. **跨域资源**
   - Service Worker 仅缓存同源资源
   - 跨域 API 需要 CORS 配置

3. **私有浏览模式**
   - Service Worker 在某些浏览器的私密模式下可能不可用

4. **版本更新**
   - 修改 `CACHE_VERSION` 会清理所有旧缓存
   - 务必测试后再部署

## 📝 相关文件

- `/public/sw.js` - Service Worker 主文件
- `/src/components/service-worker-init.tsx` - 客户端初始化组件
- `/src/app/layout.tsx` - 集成 Service Worker
- `/public/_headers` - Cloudflare 缓存策略

## 🔗 参考资源

- [MDN Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Cloudflare Cache Control](https://developers.cloudflare.com/cache/how-to/set-cache-control-headers/)
- [HTTP Cache Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
