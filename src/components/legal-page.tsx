import Link from "next/link"

interface LegalPageProps {
  title: string
  updated: string
  children: React.ReactNode
}

/** Shared chrome for static legal pages (terms, privacy). */
export function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        返回首页
      </Link>

      <h1 className="mt-6 text-2xl font-semibold text-stone-900">{title}</h1>
      <p className="mt-1 text-sm text-stone-400">最后更新：{updated}</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-stone-600">
        {children}
      </div>
    </main>
  )
}

/** A titled section within a legal page. */
export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-stone-900">{heading}</h2>
      {children}
    </section>
  )
}
