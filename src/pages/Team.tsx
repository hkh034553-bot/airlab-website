import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue } from 'framer-motion'
import { Mail, Search, Loader2, X, ArrowUpRight, FileText } from 'lucide-react'
import type { TeamMemberData } from '../types/data'
import { getMemberAvatar, DEFAULT_AVATAR } from '../lib/placeholders'
import { normalizeLinkedInUrl } from '../lib/utils'
import { fetchCollection, readCachedCollection } from '../lib/contentFetch'
import { TeamMemberEntity } from '../entities/TeamMemberEntity'
import TitleReveal from '../components/ui/TitleReveal'
import StudentApplicationModal from '../components/StudentApplicationModal'
import OptimizedTiltCard from '@/components/ui/optimized-tilt-card'
import { HoverDetailTooltip } from '@/components/ui/animated-tooltip'
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
  showDesignation?: boolean
  showTooltip?: boolean
  priority?: boolean
  onSelect: (member: TeamMemberEntity) => void
}

function MemberPortraitCard({
  member,
  isHighlighted,
  showDesignation = true,
  showTooltip = false,
  priority = false,
  onSelect,
}: MemberPortraitCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const mouseX = useMotionValue(0)
  const linkedInUrl = member.getLinkedInUrl()
  const designation = showDesignation ? (member.designation || member.role) : null

  const tooltipTitle = member.researchFocus || member.department
  const tooltipPeriod = member.term || member.tenure
  const tooltipSubtitle = member.researchFocus
    ? [member.department, tooltipPeriod].filter(Boolean).join(' • ')
    : tooltipPeriod

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showTooltip) return
    const rect = e.currentTarget.getBoundingClientRect()
    mouseX.set(e.clientX - rect.left - rect.width / 2)
  }

  const cardContent = (
    <>
      <div className="relative w-full aspect-[10/11] overflow-hidden bg-[var(--bg-page)] shrink-0">
        {!imgLoaded && (
          <div className="absolute inset-0 bg-[var(--surface-alt)] animate-pulse pointer-events-none" />
        )}
        <img
          src={getMemberAvatar(member.image)}
          onLoad={() => setImgLoaded(true)}
          onError={(e) => {
            e.currentTarget.src = DEFAULT_AVATAR
            setImgLoaded(true)
          }}
          alt={member.name}
          className={`w-full h-full object-cover object-top transition-[transform,opacity] duration-300 group-hover:scale-[1.03] ${imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
        />

        <div className="pointer-events-none absolute inset-0 bg-[var(--accent-orange)]/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 text-white text-xs font-sans font-semibold uppercase tracking-[0.2em] border-b border-white/80 pb-1">
            <span>View More Details</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      <div className="px-4 py-3.5 flex-1 flex items-center justify-between gap-2.5 bg-[var(--bg-surface)]">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-[15px] font-semibold font-head text-[var(--text-primary)] group-hover:text-[var(--accent-orange)] transition-colors leading-snug line-clamp-2">
            {member.name}
          </h3>
          {designation && (
            <p className="text-xs font-sans text-[var(--text-muted)] mt-0.5 line-clamp-1">
              {designation}
            </p>
          )}
        </div>
        {linkedInUrl && (
          <Linkedin className="w-4 h-4 shrink-0 text-[var(--text-muted)] group-hover:text-[#0A66C2] transition-colors" />
        )}
      </div>
    </>
  )

  const cardElement = (
    <OptimizedTiltCard
      id={`member-${member.id}`}
      className={`group rounded-none overflow-hidden flex flex-col h-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--accent-orange)]/40 hover:shadow-lg transition-all duration-200 ${isHighlighted ? 'ring-2 ring-[var(--accent-orange)] shadow-xl' : ''
        }`}
    >
      <button
        type="button"
        onClick={() => onSelect(member)}
        aria-label={`View more details for ${member.name}`}
        className="flex flex-col h-full w-full text-left cursor-pointer"
      >
        {cardContent}
      </button>
    </OptimizedTiltCard>
  )

  if (!showTooltip) {
    return cardElement
  }

  return (
    <div
      className="relative h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        mouseX.set(0)
      }}
      onMouseMove={handleMouseMove}
    >
      <HoverDetailTooltip
        visible={isHovered}
        mouseX={mouseX}
        title={tooltipTitle}
        subtitle={tooltipSubtitle}
      />
      {cardElement}
    </div>
  )
}

export default function Team() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>('faculty')
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMemberEntity | null>(null)
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

  const [allMembersRaw, setAllMembersRaw] = useState<TeamMemberData[]>(() =>
    readCachedCollection<TeamMemberData>('team').map((item: any) => ({
      ...item,
      linkedin: normalizeLinkedInUrl(item.linkedin) || item.linkedin,
    }))
  )
  const [sortedPreviousInterns, setSortedPreviousInterns] = useState<any[]>(() =>
    readCachedCollection<any>('previous-interns')
  )
  const [loading, setLoading] = useState<boolean>(
    () => readCachedCollection<TeamMemberData>('team').length === 0
  )

  useEffect(() => {
    let active = true
    Promise.all([
      fetchCollection<TeamMemberData>('team'),
      fetchCollection<any>('previous-interns'),
    ])
      .then(([team, prev]) => {
        if (!active) return
        if (team) {
          const normalized = team.map((item: any) => ({
            ...item,
            linkedin: normalizeLinkedInUrl(item.linkedin) || item.linkedin,
          }))
          setAllMembersRaw(normalized)
        }
        if (prev) {
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

  useEffect(() => {
    if (!selectedMember) return
    const scrollY = window.scrollY
    const originalOverflow = document.body.style.overflow
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedMember(null)
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = ''
      window.scrollTo(0, scrollY)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedMember])

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
                <div className="col-span-full text-center py-16 border border-dashed border-[var(--border-hairline)] rounded-none bg-[var(--bg-surface)]">
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
              {facultyMembers.map((f, idx) => (
                <MemberPortraitCard
                  key={f.id}
                  member={f}
                  isHighlighted={highlightedMemberId === f.id}
                  priority={idx < 4}
                  onSelect={setSelectedMember}
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
                <div className="col-span-full text-center py-16 border border-dashed border-[var(--border-hairline)] rounded-none bg-[var(--bg-surface)]">
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
              {filteredInterns.map((intern, idx) => (
                <MemberPortraitCard
                  key={intern.id}
                  member={intern}
                  isHighlighted={highlightedMemberId === intern.id}
                  showDesignation={false}
                  showTooltip
                  priority={idx < 4}
                  onSelect={setSelectedMember}
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
            <div className="overflow-hidden bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-none shadow-sm">
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

      {/* Member Detail Modal (Faculty & Research Interns) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {selectedMember && (
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
                onClick={() => setSelectedMember(null)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 10 }}
                  transition={{ duration: 0.2 }}
                  onClick={e => e.stopPropagation()}
                  className="w-full max-w-3xl bg-[var(--bg-surface-elevated)] border border-[var(--border-hairline)] rounded-none shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-left relative my-auto font-sans"
                >
                  <div className="px-6 py-4 bg-[var(--bg-surface)] border-b border-[var(--border-hairline)] flex items-center justify-between select-none">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {selectedMember.category !== 'Research Interns' && (
                        <span className="px-3 py-1 rounded-full bg-[var(--accent-orange)] text-white text-[11px] font-sans font-semibold">
                          {selectedMember.category}
                        </span>
                      )}
                      {selectedMember.isLead && (
                        <span className="px-3 py-1 rounded-full bg-[var(--bg-page)] border border-[var(--border-hairline)] text-[var(--text-primary)] text-[11px] font-sans font-semibold">
                          Faculty / Lab Lead
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedMember(null)}
                      className="p-1.5 text-[var(--text-subtle)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--bg-page)] transition-colors cursor-pointer"
                      aria-label="Close member details modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 sm:p-8 overflow-y-auto flex-1">
                    {/* Profile Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-7">
                      <div className="w-32 h-36 sm:w-40 sm:h-44 shrink-0 overflow-hidden bg-[var(--bg-page)] border border-[var(--border-hairline)] rounded-none">
                        <img
                          src={getMemberAvatar(selectedMember.image)}
                          onError={e => {
                            e.currentTarget.src = DEFAULT_AVATAR
                          }}
                          alt={selectedMember.name}
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-1.5 font-head leading-tight">
                          {selectedMember.name}
                        </h2>
                        <p className="text-sm sm:text-base font-semibold text-[var(--accent-orange)] mb-1">
                          {selectedMember.role}
                        </p>
                        {selectedMember.designation && (
                          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
                            {selectedMember.designation}
                          </p>
                        )}
                      </div>
                    </div>

                    {selectedMember.researchFocus && (
                      <div className="mb-7">
                        <span className="text-[11px] font-sans font-semibold uppercase tracking-wider text-[var(--text-subtle)] block mb-1.5">
                          RESEARCH FOCUS / SPECIALTY
                        </span>
                        <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed font-normal">
                          {selectedMember.researchFocus}
                        </p>
                      </div>
                    )}

                    {/* Member Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs font-sans">
                      <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-none">
                        <span className="text-[var(--text-subtle)] block mb-1">ROLE / TITLE</span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {selectedMember.role}
                        </span>
                      </div>

                      {selectedMember.category !== 'Research Interns' && (
                        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-none">
                          <span className="text-[var(--text-subtle)] block mb-1">CATEGORY</span>
                          <span className="font-semibold text-[var(--accent-orange)]">
                            {selectedMember.category}
                            {selectedMember.isLead ? ' • Lab Lead' : ''}
                          </span>
                        </div>
                      )}

                      {selectedMember.designation && (
                        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-none">
                          <span className="text-[var(--text-subtle)] block mb-1">ACADEMIC DESIGNATION</span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {selectedMember.designation}
                          </span>
                        </div>
                      )}

                      {selectedMember.department && (
                        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-none">
                          <span className="text-[var(--text-subtle)] block mb-1">DEPARTMENT</span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {selectedMember.department}
                          </span>
                        </div>
                      )}

                      {(selectedMember.tenure || selectedMember.startDate || selectedMember.endDate) && (
                        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-none">
                          <span className="text-[var(--text-subtle)] block mb-1">TENURE / COHORT</span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {selectedMember.startDate
                              ? `${selectedMember.startDate} — ${selectedMember.endDate || 'Present'}`
                              : selectedMember.tenure}
                          </span>
                        </div>
                      )}

                      {selectedMember.term && selectedMember.term !== selectedMember.tenure && (
                        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-none">
                          <span className="text-[var(--text-subtle)] block mb-1">TERM</span>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {selectedMember.term}
                          </span>
                        </div>
                      )}

                      {selectedMember.hasEmail() && (
                        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-none">
                          <span className="text-[var(--text-subtle)] block mb-1">EMAIL ADDRESS</span>
                          <a
                            href={`mailto:${selectedMember.email}`}
                            className="font-semibold text-[var(--accent-orange)] hover:underline inline-flex items-center gap-1.5 break-all"
                          >
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            <span>{selectedMember.email}</span>
                          </a>
                        </div>
                      )}

                      {selectedMember.getLinkedInUrl() && (
                        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-none">
                          <span className="text-[var(--text-subtle)] block mb-1">LINKEDIN</span>
                          <a
                            href={selectedMember.getLinkedInUrl()!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[var(--accent-orange)] hover:underline inline-flex items-center gap-1.5"
                          >
                            <Linkedin className="w-3.5 h-3.5 shrink-0" />
                            <span>View LinkedIn Profile</span>
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                          </a>
                        </div>
                      )}

                      {selectedMember.hasResume() && (
                        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-none">
                          <span className="text-[var(--text-subtle)] block mb-1">CV / RESUME</span>
                          <a
                            href={selectedMember.cvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[var(--accent-orange)] hover:underline inline-flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span>View CV / Resume</span>
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="px-6 py-4 bg-[var(--bg-surface)] border-t border-[var(--border-hairline)] flex items-center justify-end">
                    <InteractiveHoverButton
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedMember(null)}
                      icon={<X className="w-4 h-4" />}
                      text="Close"
                      className="font-bold"
                    />
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}
