import cron from 'node-cron'
import { fetchAllFeeds } from './rss-parser'

// 每小时执行一次RSS抓取
export function startCronJobs() {
  // 每小时的第0分钟执行
  cron.schedule('0 * * * *', async () => {
    console.log('开始定时抓取RSS源...')
    try {
      const results = await fetchAllFeeds()
      console.log('RSS抓取完成:', results)
    } catch (error) {
      console.error('RSS抓取失败:', error)
    }
  })

  console.log('定时任务已启动: 每小时抓取一次RSS源')
}
