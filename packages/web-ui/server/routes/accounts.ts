import { Hono } from 'hono'
import { getPublishingAccounts } from '@happytokenai/happyimage-core'

const accountsRoute = new Hono()

accountsRoute.get('/:platform', (c) => {
  const platform = c.req.param('platform')
  if (!['wechat', 'weibo', 'x', 'xiaohongshu'].includes(platform)) {
    return c.json({ error: 'Unsupported platform' }, 400)
  }
  return c.json(getPublishingAccounts(platform))
})

export default accountsRoute
