import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Search, Loader2, X, ArrowUpRight } from 'lucide-react'
import type { TeamMemberData } from '../types/data'
import { getMemberAvatar, DEFAULT_AVATAR } from '../lib/placeholders'
import { normalizeLinkedInUrl } from '../lib/utils'
import { TeamMemberEntity } from '../entities/TeamMemberEntity'
import TitleReveal from '../components/ui/TitleReveal'
import StudentApplicationModal from '../components/StudentApplicationModal'
import OptimizedTiltCard from '@/components/ui/optimized-tilt-card'
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button'

const Linkedin = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
  </svg>
)

type TabType = 'faculty' | 'interns' | 'previous'

interface MemberPortraitCardProps {
  member: TeamMemberEntity
  isHighlighted: boolean
}

function MemberPortraitCard({ member, isHighlighted }: MemberPortraitCardProps) {
  const linkedInUrl = member.getLinkedInUrl()
  const fallbackUrl = member.getPrimaryActionUrl()
  const targetUrl = linkedInUrl || (fallbackUrl !== '#' ? fallbackUrl : null)
  const isExternal = Boolean(linkedInUrl || (targetUrl && targetUrl.startsWith('http')))

  const cardContent = (
    <>
      <div className="pt-5 px-5 pb-3 flex justify-center bg-[var(--bg-page)]/50 shrink-0">
        <div className="relative w-36 h-40 sm:w-40 sm:h-44 rounded-2xl overflow-hidden bg-[var(--bg-page)] border border-[var(--border-hairline)] shadow-xs">
          <img
            src={getMemberAvatar(member.image)}
            onError={(e) => {
              e.currentTarget.src = DEFAULT_AVATAR
            }}
            alt={member.name}
            className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />

          {targetUrl && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 text-[var(--ink-dark)] text-xs font-sans font-semibold shadow-md translate-y-2 group-hover:translate-y-0 transition-transform duration-300 whitespace-nowrap">
                {linkedInUrl ? (
                  <>
                    <Linkedin className="w-3.5 h-3.5 text-[#0A66C2]" />
                    <span>Visit LinkedIn</span>
                  </>
                ) : (
                  <span>View Details</span>
                )}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3.5 flex-1 flex items-center justify-between gap-2.5 bg-[var(--bg-surface)]">
        <h3 className="text-sm sm:text-[15px] font-semibold font-head text-[var(--text-primary)] group-hover:text-[var(--accent-orange)] transition-colors leading-snug line-clamp-2">
          {member.name}
        </h3>
        {linkedInUrl && (
          <Linkedin className="w-4 h-4 shrink-0 text-[var(--text-muted)] group-hover:text-[#0A66C2] transition-colors" />
        )}
      </div>
    </>
  )

  return (
    <OptimizedTiltCard
      id={`member-${member.id}`}
      className={`rounded-2xl overflow-hidden flex flex-col h-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--accent-orange)]/40 hover:shadow-lg transition-all duration-200 ${isHighlighted ? 'ring-2 ring-[var(--accent-orange)] shadow-xl' : ''
        }`}
    >
      {targetUrl ? (
        <a
          href={targetUrl}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          title={linkedInUrl ? `${member.name} — LinkedIn` : member.name}
          className="flex flex-col h-full cursor-pointer"
        >
          {cardContent}
        </a>
      ) : (
        <div className="flex flex-col h-full">{cardContent}</div>
      )}
    </OptimizedTiltCard>
  )
}

export default function Team() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>('faculty')
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [highlightedMemberId, setHighlightedMemberId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const tabParam = searchParams.get('tab') as TabType
    const memberParam = searchParams.get('member')
    if (tabParam && ['faculty', 'interns', 'previous'].includes(tabParam)) {
      setActiveTab(tabParam)
    } else if (tabParam === 'all' as unknown) {
      setActiveTab('faculty')
    }
    if (memberParam) {
      setHighlightedMemberId(memberParam)
      setTimeout(() => {
        const el = document.getElementById(`member-${memberParam}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 300)
    }
  }, [searchParams])

  const [allMembersRaw, setAllMembersRaw] = useState<TeamMemberData[]>([])
  const [sortedPreviousInterns, setSortedPreviousInterns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const apiBase = import.meta.env.VITE_API_URL || ''
    Promise.all([
      fetch(`${apiBase}/api/content/team`).then(r => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${apiBase}/api/content/previous-interns`).then(r => (r.ok ? r.json() : [])).catch(() => []),
    ])
      .then(([team, prev]) => {
        if (!active) return
        if (Array.isArray(team)) {
          const normalized = team.map((item: any) => ({
            ...item,
            linkedin: normalizeLinkedInUrl(item.linkedin) || item.linkedin,
          }))
          setAllMembersRaw(normalized)
        }
        if (Array.isArray(prev)) {
          setSortedPreviousInterns(prev)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const alumniList = useMemo(() => {
    const baseList = Array.isArray(sortedPreviousInterns)
      ? [...sortedPreviousInterns]
      : []
    const candidates = allMembersRaw.filter(
      m => m.category === 'Alumni' || (m.category as string) === 'Previous Interns'
    )
    for (const item of candidates) {
      const idx = baseList.findIndex(
        m => m.id === item.id || (m.name && item.name && m.name.trim().toLowerCase() === item.name.trim().toLowerCase())
      )
      if (idx >= 0) {
        baseList[idx] = { ...baseList[idx], ...item }
      } else {
        baseList.push(item)
      }
    }
    return baseList
  }, [sortedPreviousInterns, allMembersRaw])


  const allMembers = useMemo(() => {
    const list = TeamMemberEntity.fromArray(allMembersRaw)
    return TeamMemberEntity.sortByRecent(list)
  }, [allMembersRaw])

  const facultyMembers = useMemo(() => {
    return allMembers.filter(m => m.isFacultyLead() || m.category === 'Faculty')
  }, [allMembers])

  const internMembers = useMemo(() => {
    return allMembers.filter(m => m.category === 'Research Interns')
  }, [allMembers])

  const filteredInterns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return internMembers

    return internMembers.filter(intern => {
      const matchName = intern.name.toLowerCase().includes(query)
      const matchFocus = Boolean(intern.researchFocus && intern.researchFocus.toLowerCase().includes(query))
      const matchDept = Boolean(intern.department && intern.department.toLowerCase().includes(query))
      return matchName || matchFocus || matchDept
    })
  }, [internMembers, searchQuery])

  useEffect(() => {
    if (highlightedMemberId) {
      const timer = setTimeout(() => setHighlightedMemberId(null), 3500)
      return () => clearTimeout(timer)
    }
  }, [highlightedMemberId])

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'faculty', label: 'Faculty', count: facultyMembers.length },
    { id: 'interns', label: 'Research Interns', count: internMembers.length },
    { id: 'previous', label: 'Past Interns', count: alumniList.length },
  ]

  return (
    <div className="min-h-screen pt-16 sm:pt-24 pb-28 px-6 max-w-[1240px] mx-auto relative font-sans text-[var(--text-primary)]">
      {/* Header */}
      <div className="mb-14 text-left max-w-3xl">
        <TitleReveal
          as="h1"
          waitForPreloader
          className="font-head font-semibold text-[var(--text-primary)] mb-4 tracking-tight"
        >
          LAB MEMBERS
        </TitleReveal>
      </div>

      {/* Tabs Control (Pill-shaped selectors) */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-hairline)] pb-6">
        <div className="inline-flex items-center gap-1.5 p-1.5 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-full shadow-2xs w-fit">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setHighlightedMemberId(null)
                }}
                className={`relative px-4 py-2 rounded-full text-[13.5px] font-medium transition-colors duration-150 cursor-pointer select-none whitespace-nowrap flex items-center gap-2 ${isActive
                  ? 'text-white font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="teamActiveTabPill"
                    className="absolute inset-0 rounded-full bg-[var(--accent-orange)] shadow-xs"
                    transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`relative z-10 text-[11px] font-sans px-2 py-0.5 rounded-full transition-colors ${isActive ? 'bg-white/20 text-white' : 'bg-[var(--bg-page)] text-[var(--text-muted)] border border-[var(--border-hairline)]'
                      }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Search bar inside interns tab */}
        {activeTab === 'interns' && (
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-subtle)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or focus area..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 h-10 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs font-sans text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:bg-white focus:border-[var(--accent-orange)] focus:ring-2 focus:ring-[var(--accent-orange)]/15 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-[var(--text-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tab Content Display */}
      <AnimatePresence mode="wait">
        {/* TAB 1: FACULTY */}
        {activeTab === 'faculty' && (
          <motion.div
            key="faculty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {facultyMembers.length === 0 && (
                <div className="col-span-full text-center py-16 border border-dashed border-[var(--border-hairline)] rounded-3xl bg-[var(--bg-surface)]">
                  {loading ? (
                    <div className="inline-flex items-center gap-2 text-sm font-sans text-[var(--text-muted)]">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-orange)]" />
                      <span>Loading faculty leads...</span>
                    </div>
                  ) : (
                    <p className="text-sm font-sans text-[var(--text-muted)]">No faculty members listed yet.</p>
                  )}
                </div>
              )}
              {facultyMembers.map(f => (
                <MemberPortraitCard
                  key={f.id}
                  member={f}
                  isHighlighted={highlightedMemberId === f.id}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* TAB 3: CURRENT RESEARCH INTERNS */}
        {activeTab === 'interns' && (
          <motion.div
            key="interns"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredInterns.length === 0 && (
                <div className="col-span-full text-center py-16 border border-dashed border-[var(--border-hairline)] rounded-3xl bg-[var(--bg-surface)]">
                  {loading ? (
                    <div className="inline-flex items-center gap-2 text-sm font-sans text-[var(--text-muted)]">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-orange)]" />
                      <span>Loading research scholars...</span>
                    </div>
                  ) : (
                    <p className="text-sm font-sans text-[var(--text-muted)]">
                      {searchQuery ? `No interns match "${searchQuery}".` : 'No research interns listed yet.'}
                    </p>
                  )}
                </div>
              )}
              {filteredInterns.map(intern => (
                <MemberPortraitCard
                  key={intern.id}
                  member={intern}
                  isHighlighted={highlightedMemberId === intern.id}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* TAB 4: PREVIOUS INTERNS & ALUMNI */}
        {activeTab === 'previous' && (
          <motion.div
            key="previous"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-8 text-left"
          >
            <div className="overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-3xl shadow-sm">
              <div className="p-6 sm:p-8 border-b border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold font-head text-[var(--text-primary)]">
                    Past Research Interns
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 font-normal">
                    Researchers and interns who completed their research terms at AIR Lab.
                  </p>
                </div>
                <span className="px-3.5 py-1.5 rounded-full text-xs font-sans font-medium bg-[var(--ink-dark)] text-white shrink-0">
                  {alumniList.length} Past Interns Recorded
                </span>
              </div>

              <div className="overflow-x-auto">
                {alumniList.length === 0 ? (
                  <div className="text-center py-16 text-xs text-[var(--text-muted)] font-sans">
                    No past interns listed yet.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs sm:text-sm font-sans">
                    <thead>
                      <tr className="border-b border-[var(--border-hairline)] font-sans text-[11px] uppercase tracking-wider text-[var(--text-subtle)] bg-[var(--bg-page)]">
                        <th className="py-4 px-6 font-semibold">Name</th>
                        <th className="py-4 px-6 font-semibold">Period & Department</th>
                        <th className="py-4 px-6 font-semibold">Email</th>
                        <th className="py-4 px-6 text-right font-semibold">LinkedIn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-hairline)]">
                      {alumniList.map((p: any) => {
                        const memberKey = p.id || p._id
                        return (
                          <tr
                            key={memberKey}
                            id={`member-${memberKey}`}
                            className={`hover:bg-[var(--bg-page)] transition-colors ${highlightedMemberId === memberKey || highlightedMemberId === p.id ? 'bg-[var(--accent-orange)]/15 ring-2 ring-[var(--accent-orange)]' : ''
                              }`}
                          >
                            <td className="py-4 px-6 font-semibold text-[var(--text-primary)]">
                              {p.name}
                            </td>
                            <td className="py-4 px-6 text-[var(--text-muted)] font-sans text-xs">
                              {p.tenure || 'Former Research Intern'} • {p.department}
                            </td>
                            <td className="py-4 px-6 font-sans text-xs text-[var(--text-muted)]">
                              <a href={`mailto:${p.email}`} className="text-[var(--accent-orange)] hover:underline flex items-center gap-1 font-semibold">
                                <Mail className="w-3.5 h-3.5 text-[var(--accent-orange)]" />
                                {p.email}
                              </a>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <InteractiveHoverButton
                                href={p.linkedin}
                                variant="secondary"
                                size="xs"
                                icon={<Linkedin className="w-3.5 h-3.5" />}
                                text="LinkedIn"
                                className="bg-[var(--bg-page)] text-[var(--ink-dark)] font-medium"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Student Fellowship Modal */}
      <StudentApplicationModal
        isOpen={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
      />
    </div>
  )
}
