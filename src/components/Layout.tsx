import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-ink">
      <Navbar />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:max-w-2xl md:max-w-5xl sm:px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <Outlet />
      </main>
    </div>
  )
}
