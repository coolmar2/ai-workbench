import { ArrowRightLeft, Check, Eye, Laptop, Radio } from 'lucide-react'
import { useIdentity, type Identity } from '../../context/identity'
import {
  AgentMark,
  Badge,
  Button,
  Card,
  IdentityMark,
  PageHeader,
  ScrollArea,
  SegmentedControl,
  cn,
  toast,
} from '../../components/ui'
import { useAccounts } from '../../live/accounts'
import { buildCards, EXPLANATION, HEADING, NOTES, RC_PERSONAL, RC_WORK, type IdentityCard } from './data'

const NOTE_ICONS = [ArrowRightLeft, Laptop, Eye]
const LABEL: Record<Identity, string> = { personal: 'Personal', work: 'Work' }

/**
 * Identity: the reference implementation of the kit style.
 * Two account cards (side by side, stacked on narrow screens), segmented active state, Remote Control switches.
 */
export default function IdentityPage() {
  const { identity, setIdentity } = useIdentity()
  const cards = buildCards(useAccounts())

  const switchTo = (id: Identity) => {
    if (id === identity) return
    setIdentity(id)
    toast(`Switched to ${LABEL[id]}`, { description: 'Sessions, models and workers now follow this identity.' })
  }

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
        <PageHeader
          title={HEADING}
          description={EXPLANATION}
          actions={
            <SegmentedControl<Identity>
              label="Active identity"
              value={identity}
              onValueChange={switchTo}
              options={[
                { value: 'personal', label: 'Personal', icon: <IdentityMark identity="personal" /> },
                { value: 'work', label: 'Work', icon: <IdentityMark identity="work" /> },
              ]}
            />
          }
        />

        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c) => (
            <AccountCard key={c.id} card={c} active={identity === c.id} onSwitch={() => switchTo(c.id)} />
          ))}
        </div>

        <section aria-labelledby="id-notes" className="flex flex-col gap-2">
          <h2 id="id-notes" className="caps">
            How it works
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {NOTES.map((n, i) => {
              const Icon = NOTE_ICONS[i] ?? Eye
              return (
                <Card key={n.title} className="flex gap-3 p-4">
                  <Icon aria-hidden className="mt-0.5 size-3.5 text-3" />
                  <div className="min-w-0">
                    <h3 className="text-body font-medium text-1">{n.title}</h3>
                    <p className="mt-1 text-caption text-3">{n.body}</p>
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      </div>
    </ScrollArea>
  )
}

function AccountCard({ card: c, active, onSwitch }: { card: IdentityCard; active: boolean; onSwitch: () => void }) {
  const isWork = c.id === 'work'

  return (
    <Card
      role="region"
      aria-label={`${LABEL[c.id]} identity`}
      className={cn(
        'relative flex flex-col p-4 transition-colors-fast sm:p-5',
        active && (isWork ? 'border-work/40' : 'border-personal/40'),
      )}
    >
      <div className="flex min-h-[18px] flex-wrap items-center gap-2">
        <Badge tone={c.id} caps>
          <IdentityMark identity={c.id} />
          {LABEL[c.id]}
        </Badge>
        {c.managed && <span className="text-meta text-3">{c.managed}</span>}
        {active && (
          <span className={cn('ml-auto flex items-center gap-1 text-caption font-medium', isWork ? 'text-work' : 'text-personal')}>
            <Check aria-hidden className="size-3.5" />
            Active
          </span>
        )}
      </div>

      <h2 className="mt-3 text-title font-semibold text-1">{c.title}</h2>
      <p className="mt-0.5 text-caption text-3">{c.subtitle}</p>

      <h3 className="caps mt-5 mb-1">Models and workers</h3>
      <ul className="divide-y divide-stroke-3">
        {c.accounts.map((a) => (
          <li key={a.vendor} className={cn('flex items-center gap-3 py-2.5', !a.available && 'opacity-55')}>
            <AgentMark vendor={a.vendor} size={14} respectIdentity={false} />
            <div className="min-w-0 flex-1">
              <div className="text-body font-medium text-1">{a.name}</div>
              <div className="text-caption text-3">{a.detail}</div>
            </div>
            <Badge tone={a.available ? 'success' : 'outline'}>{a.status}</Badge>
          </li>
        ))}
      </ul>

      <div className="mt-1 flex items-start gap-3 border-t border-stroke-3 pt-3">
        <Radio aria-hidden className="mt-0.5 size-3.5 text-3" />
        <div className="min-w-0 flex-1">
          <div className="text-body font-medium text-1">Remote Control</div>
          <p className="text-caption text-3">{isWork ? RC_WORK : RC_PERSONAL}</p>
        </div>
      </div>

      <div className="mt-auto pt-4">
        {active ? (
          <Button key="active" className="w-full" disabled icon={<Check />}>
            This identity is active
          </Button>
        ) : (
          <Button key="switch" className="w-full" variant="primary" onClick={onSwitch}>
            Switch to {LABEL[c.id]}
          </Button>
        )}
      </div>
    </Card>
  )
}
