import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { LanguageProvider } from "@/contexts/language-context"
import { AuthProvider } from "@/contexts/auth-context"
import { Header } from "@/components/header"
import { AuthModal } from "@/components/auth-modal"
import { Onboarding } from "@/components/onboarding"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Fluvient",
  description: "通过 YouTube 视频学英语，实时字幕同步，AI 生成学习笔记",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh" className={`${inter.variable} h-full`}>
      <body className="h-full flex flex-col">
        <AuthProvider>
          <LanguageProvider>
            <Header />
            {children}
            <AuthModal />
            <Onboarding />
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
