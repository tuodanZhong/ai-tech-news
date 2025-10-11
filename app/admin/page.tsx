'use client'

import { useState } from 'react'
import Link from 'next/link'
import AdminAuthGuard from '@/components/AdminAuthGuard'

interface CronResult {
  success: boolean
  startTime: string
  endTime: string
  duration: number
  steps: {
    collect?: { collected: number; newArticles: number }
    filter?: { total: number; relevant: number; irrelevant: number }
    translate?: { translated: number; failed: number }
    analyze?: { hotTopics12h: number; hotTopics24h: number }
  }
  error?: string
}

export default function AdminDashboard() {
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<CronResult | null>(null)

  const executeCronJob = async () => {
    setExecuting(true)
    setResult(null)

    try {
      const startTime = Date.now()
      const response = await fetch('/api/cron-job', {
        method: 'GET'
      })

      const data = await response.json()
      const endTime = Date.now()

      setResult({
        success: response.ok,
        startTime: new Date(startTime).toLocaleString('zh-CN'),
        endTime: new Date(endTime).toLocaleString('zh-CN'),
        duration: Math.round((endTime - startTime) / 1000),
        steps: data,
        error: response.ok ? undefined : (data.error || '执行失败')
      })
    } catch (error) {
      setResult({
        success: false,
        startTime: new Date().toLocaleString('zh-CN'),
        endTime: new Date().toLocaleString('zh-CN'),
        duration: 0,
        steps: {},
        error: error instanceof Error ? error.message : '网络错误'
      })
    } finally {
      setExecuting(false)
    }
  }

  return (
    <AdminAuthGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-8 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">后台管理中心</h1>
          <p className="text-gray-600">管理系统配置、执行定时任务、查看数据统计</p>
        </div>

        {/* 功能卡片区域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* 定时任务执行 */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 flex flex-col h-full">
            <div className="flex items-start mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">定时任务</h2>
                <p className="text-sm text-gray-500">手动触发数据采集</p>
              </div>
            </div>
            <div className="mt-auto">
              <button
                onClick={executeCronJob}
                disabled={executing}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {executing ? '执行中...' : '执行定时任务'}
              </button>
            </div>
          </div>

          {/* 提示词管理 */}
          <Link href="/admin/prompts" className="h-full">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer h-full flex flex-col hover:border-purple-300">
              <div className="flex items-start mb-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">提示词管理</h2>
                  <p className="text-sm text-gray-500">编辑 AI 提示词配置</p>
                </div>
              </div>
              <div className="mt-auto">
                <div className="w-full px-4 py-3 bg-purple-50 text-purple-700 rounded-md text-center font-medium hover:bg-purple-100 transition-colors">
                  进入管理 →
                </div>
              </div>
            </div>
          </Link>

          {/* 数据源管理 */}
          <Link href="/admin/sources" className="h-full">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer h-full flex flex-col hover:border-green-300">
              <div className="flex items-start mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">数据源管理</h2>
                  <p className="text-sm text-gray-500">添加和管理 RSS 源</p>
                </div>
              </div>
              <div className="mt-auto">
                <div className="w-full px-4 py-3 bg-green-50 text-green-700 rounded-md text-center font-medium hover:bg-green-100 transition-colors">
                  进入管理 →
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* 执行结果显示 */}
        {result && (
          <div className={`rounded-lg shadow-md border p-6 ${
            result.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center mb-4">
              {result.success ? (
                <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <h3 className={`text-xl font-semibold ${
                result.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {result.success ? '执行成功' : '执行失败'}
              </h3>
            </div>

            {result.error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-800">
                <strong>错误：</strong> {result.error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <span className="text-gray-600">开始时间：</span>
                <span className="font-medium ml-2">{result.startTime}</span>
              </div>
              <div>
                <span className="text-gray-600">结束时间：</span>
                <span className="font-medium ml-2">{result.endTime}</span>
              </div>
              <div>
                <span className="text-gray-600">执行耗时：</span>
                <span className="font-medium ml-2">{result.duration} 秒</span>
              </div>
            </div>

            {result.success && result.steps && (
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 mb-2">执行详情：</h4>

                {result.steps.collect && (
                  <div className="p-3 bg-white rounded border border-gray-200">
                    <div className="font-medium text-gray-900 mb-1">📥 数据采集</div>
                    <div className="text-sm text-gray-600">
                      采集文章：{result.steps.collect.collected} 篇 |
                      新增文章：{result.steps.collect.newArticles} 篇
                    </div>
                  </div>
                )}

                {result.steps.filter && (
                  <div className="p-3 bg-white rounded border border-gray-200">
                    <div className="font-medium text-gray-900 mb-1">🔍 内容过滤</div>
                    <div className="text-sm text-gray-600">
                      总数：{result.steps.filter.total} 篇 |
                      相关：{result.steps.filter.relevant} 篇 |
                      不相关：{result.steps.filter.irrelevant} 篇
                    </div>
                  </div>
                )}

                {result.steps.translate && (
                  <div className="p-3 bg-white rounded border border-gray-200">
                    <div className="font-medium text-gray-900 mb-1">🌐 内容翻译</div>
                    <div className="text-sm text-gray-600">
                      成功：{result.steps.translate.translated} 篇 |
                      失败：{result.steps.translate.failed} 篇
                    </div>
                  </div>
                )}

                {result.steps.analyze && (
                  <div className="p-3 bg-white rounded border border-gray-200">
                    <div className="font-medium text-gray-900 mb-1">🔥 热点分析</div>
                    <div className="text-sm text-gray-600">
                      12小时热点：{result.steps.analyze.hotTopics12h} 个 |
                      24小时热点：{result.steps.analyze.hotTopics24h} 个
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </AdminAuthGuard>
  )
}
