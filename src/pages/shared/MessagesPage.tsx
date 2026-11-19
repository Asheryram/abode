/** MSG-001 to 009: conversations tied to an enquiry, viewing or booking. One screen for both sides. */
import { MessageSquare, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ThreadSummary } from '../../contracts'
import { Button, cx, EmptyState, ErrorAlert, ErrorState, PageHeader, Spinner } from '../../design-system'
import { useAction } from '../../hooks/useAction'
import { useAsync } from '../../hooks/useAsync'
import { usePoll } from '../../hooks/usePoll'
import { formatTime, timeAgo } from '../../lib/format'
import { api } from '../../services/api'

export function SeekerMessages() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Messages side="seeker" base="/messages" />
    </div>
  )
}

export function PortalMessages() {
  return <Messages side="org" base="/portal/messages" />
}

function Messages({ side, base }: { side: ThreadSummary['as']; base: string }) {
  const { threadId } = useParams()
  const list = useAsync(() => api.pub.threads(), [])
  const reloadList = useCallback(() => list.reload(), [list])
  usePoll(reloadList, 15_000)
  const threads = list.data?.filter((t) => t.as === side) ?? []

  return (
    <div>
      <PageHeader title="Messages" subtitle="Keep conversations on Abode. Never pay a deposit before you’ve seen a property." />
      {list.loading && !list.data ? (
        <Spinner />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : !threads.length ? (
        <EmptyState icon={MessageSquare} title="No messages yet" body="Conversations start from an enquiry, a viewing or a booking." />
      ) : (
        <div className="grid min-h-[60vh] overflow-hidden rounded-2xl border border-line bg-white md:grid-cols-[300px_1fr]">
          <ul className={cx('divide-y divide-line border-line md:border-r', threadId && 'hidden md:block')}>
            {threads.map((t) => (
              <li key={t.id}>
                <Link to={`${base}/${t.id}`} className={cx('block px-4 py-3 hover:bg-stone-50', t.id === threadId && 'bg-brand-50')}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-semibold">{t.otherParty}</p>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(t.lastAt)}</span>
                  </div>
                  <p className="truncate text-sm">{t.subject}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-muted">{t.lastMessage}</p>
                    {t.unread > 0 && <span className="grid min-w-5 shrink-0 place-items-center rounded-full bg-brand-700 px-1.5 text-xs font-bold text-white">{t.unread}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className={cx(!threadId && 'hidden md:grid md:place-items-center')}>
            {threadId ? <Conversation key={threadId} threadId={threadId} base={base} onSent={list.reload} /> : <p className="text-muted">Choose a conversation.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

function Conversation({ threadId, base, onSent }: { threadId: string; base: string; onSent(): void }) {
  const { data, error, loading, reload } = useAsync(() => api.pub.thread(threadId), [threadId])
  const poll = useCallback(() => reload(), [reload])
  usePoll(poll, 5000)
  const [body, setBody] = useState('')
  const send = useAction()
  const end = useRef<HTMLDivElement>(null)
  const count = data?.messages.length ?? 0
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [count])

  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorState error={error} onRetry={reload} />
  return (
    <div className="flex h-full max-h-[75vh] flex-col">
      <div className="border-b border-line px-4 py-3">
        <Link to={base} className="mb-1 block text-sm font-semibold text-brand-700 md:hidden">← All messages</Link>
        <p className="font-semibold">{data.thread.otherParty}</p>
        <p className="text-sm text-muted">{data.thread.subject}</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {data.messages.map((m) => (
          <div key={m.id} className={cx('flex', m.mine ? 'justify-end' : 'justify-start')}>
            <div className={cx('max-w-[80%] rounded-2xl px-4 py-2.5', m.mine ? 'bg-brand-700 text-white' : 'bg-stone-100')}>
              {!m.mine && <p className="text-xs font-semibold">{m.sender.name}</p>}
              <p className="whitespace-pre-line">{m.body}</p>
              <p className={cx('mt-1 text-[11px]', m.mine ? 'text-white/80' : 'text-muted')}>{formatTime(m.at)}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {data.thread.closed ? (
        <p className="border-t border-line px-4 py-3 text-sm text-muted">This conversation is closed.</p>
      ) : (
        <form
          className="flex items-end gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault()
            void send.run(async () => {
              await api.pub.send(threadId, body)
              setBody('')
              reload()
              onSent()
            })
          }}
        >
          <label className="sr-only" htmlFor="msg">Message</label>
          <textarea id="msg" rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message" className="min-h-12 flex-1 resize-none rounded-xl border border-ink/20 px-3.5 py-2.5 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 focus:outline-none" />
          <Button type="submit" loading={send.busy} disabled={!body.trim()} aria-label="Send">
            <Send className="size-4" aria-hidden />
          </Button>
        </form>
      )}
      {send.error ? <div className="px-3 pb-3"><ErrorAlert error={send.error} /></div> : null}
    </div>
  )
}
