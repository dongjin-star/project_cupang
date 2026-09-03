import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '쿠팡 상품등록 어시스턴트',
  description:
    '도매 상품 정보를 넣으면 쿠팡 WING 상품등록 폼의 모든 입력값을 추천하고, 마진과 정책 위반을 먼저 걸러줍니다.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1f5eff',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  )
}
