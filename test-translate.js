// 测试翻译功能
async function testTranslation() {
  console.log('🧪 开始测试翻译功能...\n')

  // 测试英文翻译
  const englishText = 'Apple releases new iPhone with advanced AI features'
  console.log('📝 原文 (英文):', englishText)

  try {
    const url = `http://localhost:3001/api/translate`

    // 先检查数据库中是否有未翻译的文章
    const checkResponse = await fetch('http://localhost:3001/api/articles?limit=1')
    const checkData = await checkResponse.json()

    console.log('\n📊 数据库状态:')
    console.log('- 总文章数:', checkData.pagination?.total || 0)
    console.log('- 当前页文章:', checkData.articles?.length || 0)

    if (checkData.articles && checkData.articles.length > 0) {
      const firstArticle = checkData.articles[0]
      console.log('\n📰 第一篇文章:')
      console.log('- 标题:', firstArticle.title)
      console.log('- 是否已翻译:', firstArticle.isTranslated ? '✅' : '❌')
    }

    // 执行翻译
    console.log('\n🔄 开始翻译...')
    const startTime = Date.now()

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page: 1,
        limit: 5, // 只翻译5篇测试
      }),
    })

    const data = await response.json()
    const duration = Date.now() - startTime

    console.log('\n✅ 翻译结果:')
    console.log('- 成功:', data.success ? '✅' : '❌')
    console.log('- 消息:', data.message)
    console.log('- 翻译数量:', data.count || 0)
    console.log('- 耗时:', duration + 'ms')
    console.log('- 平均每篇:', data.count > 0 ? Math.round(duration / data.count) + 'ms' : 'N/A')

  } catch (error) {
    console.error('❌ 测试失败:', error.message)
  }
}

testTranslation()
