# 图片模型目录同步

HappyToken 默认供应商的图片选择器通过登录后的 `GET /api/auth/image-models`
读取 NewAPI `/api/pricing`，按 `image_group`（默认 `image`）筛选图片模型。
判断图片模型使用名称包含 `image` 或图片端点能力；聊天模型和其他分组不进入目录。
成功结果是完整目录，移除或停用的模型不会被旧会话列表重新加入。

目录正常缓存 60 秒，图像设置里的“刷新模型”可提前刷新（最短间隔 5 秒）。
同步模型 ID、按次/按量计费类型和基础单次美元价格，不改变 NewAPI 实际扣费规则。
首次失败使用管理员配置的目录；后续失败保留进程中最后成功的结果，界面提示未同步。
有效的空目录会清空选择器并禁止提交。自定义供应商继续使用用户配置的模型。

服务器设置 `HAPPYIMAGE_NEWAPI_INTERNAL_URL=http://newapi:3000`，只供后端查询目录。
此变量不能替换浏览器可访问的网关地址。未设置时使用运行配置中的网关管理地址。
API 响应设置 `Cache-Control: private, no-store`，客户端不直接访问 NewAPI 价格接口。

首次发布这段代码及内网地址需要更新 API 容器和 Web Worker；之后修改 NewAPI 模型
和价格不需要重启 HappyImage，也不需要重新登录。编辑继续使用相同模型 ID，调用
`/v1/images/edits`，无须创建额外的 `-edits` 模型。
