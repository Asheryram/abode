import { CircleAlert, CircleCheck } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type Tone = 'success' | 'error'
interface Toast {
  id: number
  message: string
  tone: Tone
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const next = useRef(1)

  const toast = useCallback((message: string, tone: Tone = 'success') => {
    const id = next.current++
    setToasts((t) => [...t.slice(-2), { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3500)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-lg"
          >
            {t.tone === 'error' ? (
              <CircleAlert className="mt-px size-4 shrink-0 text-red-300" />
            ) : (
              <CircleCheck className="mt-px size-4 shrink-0 text-brand-300" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
