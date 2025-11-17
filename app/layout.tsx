import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '儿童中文认知 + 英文跟读 App',
  description: '帮助儿童学习中文认知和英文跟读的教育应用',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}

