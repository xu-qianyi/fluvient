"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { SettingsMenu } from "./settings-menu"
import { useAuth } from "@/contexts/auth-context"

export function Header() {
  const { user, loading, signOut, showAuthModal } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    fetch("/api/admin/status")
      .then((r) => r.json())
      .then((d) => setIsAdmin(!!d.admin))
      .catch(() => setIsAdmin(false))
  }, [user])

  return (
    <header className="flex items-center justify-between h-12 px-4 shrink-0 bg-transparent">
      <Link href="/" className="text-sm font-semibold text-stone-900 tracking-tight">
        EchoLingo
      </Link>

      <div className="flex items-center gap-2">
        <SettingsMenu />

        {/* Auth area */}
        {!loading && (
          user ? (
            <div ref={ref} className="relative">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-stone-900 text-white text-xs font-semibold hover:bg-stone-700 transition-colors"
              >
                {user.email?.[0].toUpperCase() ?? "U"}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-1 w-48 rounded-lg border border-stone-200 bg-white shadow-sm py-1 z-50">
                  <div className="px-3 py-2 border-b border-transparent">
                    <p className="text-xs text-stone-500 truncate">{user.email}</p>
                  </div>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setDropdownOpen(false)}
                      className="flex w-full items-center px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                    >
                      缓存后台
                    </Link>
                  )}
                  <button
                    onClick={() => { setDropdownOpen(false); signOut() }}
                    className="flex w-full items-center px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={showAuthModal}
              className="h-8 px-3 rounded-md text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
            >
              登录
            </button>
          )
        )}
      </div>
    </header>
  )
}
