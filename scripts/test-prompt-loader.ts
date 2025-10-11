// 测试提示词加载器
import { loadPrompt, renderPrompt } from '../lib/prompt-loader'

async function main() {
  console.log('=== 测试提示词加载器 ===\n')

  // 1. 测试加载 RSS 分析提示词
  console.log('[测试1] 加载 RSS 分析提示词...')
  const rssPrompt = await loadPrompt('rss_analysis')

  if (rssPrompt) {
    console.log(`✓ 加载成功: ${rssPrompt.name} (v${rssPrompt.version})`)
    console.log(`  - Key: ${rssPrompt.key}`)
    console.log(`  - System Prompt: ${rssPrompt.systemPrompt}`)
    console.log(`  - Temperature: ${rssPrompt.temperature}`)
    console.log(`  - Use JSON Mode: ${rssPrompt.useJsonMode}`)
    console.log(`  - 模板变量: ${rssPrompt.userPromptTemplate.match(/\{\{.*?\}\}/g)?.join(', ')}`)
  } else {
    console.error('✗ 加载失败')
  }

  // 2. 测试模板变量替换
  console.log('\n[测试2] 测试模板变量替换...')
  if (rssPrompt) {
    const rendered = renderPrompt(rssPrompt.userPromptTemplate, {
      count: 5,
      feedUrl: 'https://example.com/feed',
      titles: '1. 标题1\n2. 标题2\n3. 标题3'
    })

    const hasVariables = /\{\{.*?\}\}/.test(rendered)
    if (hasVariables) {
      console.error('✗ 变量替换失败，仍然包含 {{}} 占位符')
      console.log('渲染结果预览:', rendered.substring(0, 200))
    } else {
      console.log('✓ 变量替换成功')
      console.log('渲染结果预览:')
      console.log(rendered.substring(0, 300) + '...')
    }
  }

  // 3. 测试加载内容过滤提示词
  console.log('\n[测试3] 加载内容过滤提示词...')
  const filterPrompt = await loadPrompt('content_filter')

  if (filterPrompt) {
    console.log(`✓ 加载成功: ${filterPrompt.name} (v${filterPrompt.version})`)
    console.log(`  - 模板变量: ${filterPrompt.userPromptTemplate.match(/\{\{.*?\}\}/g)?.join(', ')}`)
  } else {
    console.error('✗ 加载失败')
  }

  // 4. 测试加载热点分析提示词
  console.log('\n[测试4] 加载热点分析提示词...')
  const trendingPrompt = await loadPrompt('trending_analysis')

  if (trendingPrompt) {
    console.log(`✓ 加载成功: ${trendingPrompt.name} (v${trendingPrompt.version})`)
    console.log(`  - 模板变量: ${trendingPrompt.userPromptTemplate.match(/\{\{.*?\}\}/g)?.join(', ')}`)
  } else {
    console.error('✗ 加载失败')
  }

  // 5. 测试加载不存在的提示词
  console.log('\n[测试5] 测试加载不存在的提示词...')
  const nonExistent = await loadPrompt('non_existent_key')

  if (nonExistent === null) {
    console.log('✓ 正确返回 null')
  } else {
    console.error('✗ 应该返回 null')
  }

  console.log('\n=== 测试完成 ===')
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))
