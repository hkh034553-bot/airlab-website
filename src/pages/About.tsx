import { useRef } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import TitleReveal from '../components/ui/TitleReveal'
import BlurReveal from '../components/ui/blur-reveal'
import OptimizedTiltCard from '@/components/ui/optimized-tilt-card'

const AIMS = [
  'Advance AI research in security, language, speech, and vision, with a focus on problems that matter locally.',
  'Build practical, efficient AI that works within the data, language, and resource realities of Pakistan.',
  'Close the gap between academic research and real-world deployment.',
]

const OBJECTIVES = [
  'Conduct and publish original research in adversarial AI, NLP, computer vision, and agentic systems.',
  'Develop AI solutions that fit local languages, data, and resource constraints.',
  'Build and share datasets, benchmarks, and tools that reflect Pakistani contexts and users.',
  'Turn research into practical, privacy-preserving prototypes that address real local needs.',
  'Train students through projects, competitions, and mentorship.',
  'Collaborate with industry, government, and academia on locally driven problems.',
]

/** Geometric SVG: Neural Research-to-Deployment Flow */
function ResearchFlowVisual() {
  return (
    <OptimizedTiltCard className="group relative w-full rounded-none bg-[var(--ink-dark)] border border-[var(--border-hairline)] hover:border-[var(--accent-orange)] hover:shadow-[0_20px_48px_rgba(123,44,191,0.22)] transition-all duration-300 p-6 sm:p-8 flex flex-col items-center justify-center overflow-hidden shadow-xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-radial from-[#C77DFF]/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      />
      <svg
        viewBox="0 0 360 170"
        fill="none"
        aria-hidden="true"
        className="relative z-10 w-full max-w-[340px] h-auto transition-transform duration-500 group-hover:scale-[1.04]"
      >
        <defs>
          <linearGradient id="spineFlowGrad" x1="0" y1="0" x2="360" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E0AAFF" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#C77DFF" stopOpacity="1" />
            <stop offset="100%" stopColor="#9D4EDD" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <path
          d="M 32 85 C 100 20, 140 150, 180 85 C 220 20, 260 150, 328 85"
          stroke="url(#spineFlowGrad)"
          strokeWidth="2"
          strokeDasharray="6 6"
        />
        <path
          d="M 32 85 C 100 140, 140 30, 180 85 C 220 140, 260 30, 328 85"
          stroke="rgba(224,170,255,0.28)"
          strokeWidth="1.4"
        />
        {[
          { cx: 32, cy: 85, r: 9 },
          { cx: 106, cy: 62, r: 5 },
          { cx: 180, cy: 85, r: 12 },
          { cx: 254, cy: 108, r: 5 },
          { cx: 328, cy: 85, r: 9 },
        ].map((n, i) => (
          <g key={i} className="transition-transform duration-300 origin-center">
            <circle
              cx={n.cx}
              cy={n.cy}
              r={n.r + 9}
              fill="rgba(199,125,255,0.12)"
              className="transition-opacity duration-300 group-hover:opacity-100 opacity-70"
            />
            <circle cx={n.cx} cy={n.cy} r={n.r} fill="#10002B" stroke="#C77DFF" strokeWidth="2" />
            <circle cx={n.cx} cy={n.cy} r={n.r * 0.4} fill="#FFFFFF" />
          </g>
        ))}
      </svg>
      <span className="relative z-10 mt-3 text-[11px] font-sans uppercase tracking-[0.2em] text-white/45 group-hover:text-[#E0AAFF] transition-colors duration-300">
        Research → Deployment
      </span>
    </OptimizedTiltCard>
  )
}

/** Geometric SVG: Orbital Vision */
function VisionOrbitVisual() {
  return (
    <OptimizedTiltCard className="group relative w-full rounded-none bg-white text-[var(--ink-dark)] border border-white/80 hover:border-[#C77DFF] hover:shadow-[0_16px_44px_rgba(199,125,255,0.28)] transition-all duration-300 p-6 sm:p-8 flex flex-col items-center justify-center shadow-xl overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-radial from-[#C77DFF]/15 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      />
      <svg
        viewBox="0 0 260 180"
        fill="none"
        aria-hidden="true"
        className="relative z-10 w-full max-w-[260px] h-auto transition-transform duration-500 group-hover:scale-[1.05]"
      >
        <circle cx="130" cy="90" r="72" stroke="rgba(123,44,191,0.18)" strokeWidth="1.25" strokeDasharray="4 4" />
        <circle cx="130" cy="90" r="50" stroke="rgba(123,44,191,0.35)" strokeWidth="1.5" />
        <ellipse
          cx="130"
          cy="90"
          rx="84"
          ry="26"
          transform="rotate(-22 130 90)"
          stroke="#7B2CBF"
          strokeOpacity="0.65"
          strokeWidth="1.6"
        />
        <ellipse
          cx="130"
          cy="90"
          rx="84"
          ry="26"
          transform="rotate(22 130 90)"
          stroke="#9D4EDD"
          strokeOpacity="0.45"
          strokeWidth="1.4"
        />
        <circle cx="130" cy="90" r="15" fill="rgba(123,44,191,0.12)" stroke="#7B2CBF" strokeWidth="2" />
        <circle cx="130" cy="90" r="5" fill="#7B2CBF" />
        <circle cx="204" cy="60" r="4.5" fill="#7B2CBF" />
        <circle cx="58" cy="122" r="4" fill="#9D4EDD" />
      </svg>
      <span className="relative z-10 mt-3 text-[11px] font-sans uppercase tracking-[0.2em] text-[var(--ink-dark)]/50 group-hover:text-[#7B2CBF] transition-colors duration-300 font-semibold">
        Building AI Locally
      </span>
    </OptimizedTiltCard>
  )
}

/** Geometric SVG: Mission Convergence */
function MissionConvergenceVisual() {
  return (
    <OptimizedTiltCard className="group relative w-full rounded-none bg-white/[0.04] border border-white/12 hover:border-[#C77DFF]/60 hover:bg-white/[0.07] hover:shadow-[0_0_36px_rgba(199,125,255,0.18)] transition-all duration-300 p-6 sm:p-8 flex flex-col items-center justify-center overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-radial from-[#C77DFF]/15 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      />
      <svg
        viewBox="0 0 280 160"
        fill="none"
        aria-hidden="true"
        className="relative z-10 w-full max-w-[280px] h-auto transition-transform duration-500 group-hover:scale-[1.04]"
      >
        {[28, 62, 98, 132].map((y, idx) => (
          <path
            key={idx}
            d={`M 24 ${y} C 100 ${y}, 140 80, 236 80`}
            stroke="rgba(199,125,255,0.45)"
            strokeWidth="1.75"
          />
        ))}
        {[28, 62, 98, 132].map((y, idx) => (
          <circle key={idx} cx="24" cy={y} r="5" fill="#10002B" stroke="#C77DFF" strokeWidth="2" />
        ))}
        <circle cx="236" cy="80" r="22" fill="rgba(199,125,255,0.14)" />
        <circle cx="236" cy="80" r="11" fill="#C77DFF" />
        <circle cx="236" cy="80" r="4" fill="#FFFFFF" />
      </svg>
      <span className="relative z-10 mt-3 text-[11px] font-sans uppercase tracking-[0.2em] text-white/45 group-hover:text-[#E0AAFF] transition-colors duration-300">
        Research → Impact
      </span>
    </OptimizedTiltCard>
  )
}

/** Geometric SVG: Aims Target & Alignment */
function AimsTargetVisual() {
  return (
    <OptimizedTiltCard className="group relative w-full rounded-none bg-[var(--ink-dark)] border border-[var(--border-hairline)] hover:border-[var(--accent-orange)] hover:shadow-[0_20px_48px_rgba(123,44,191,0.22)] transition-all duration-300 p-6 sm:p-8 flex flex-col items-center justify-center overflow-hidden shadow-xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-radial from-[#C77DFF]/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      />
      <svg
        viewBox="0 0 280 170"
        fill="none"
        aria-hidden="true"
        className="relative z-10 w-full max-w-[280px] h-auto transition-transform duration-500 group-hover:scale-[1.04]"
      >
        <circle cx="140" cy="85" r="64" stroke="rgba(224,170,255,0.2)" strokeWidth="1.25" strokeDasharray="4 4" />
        <circle cx="140" cy="85" r="42" stroke="rgba(199,125,255,0.45)" strokeWidth="1.5" />
        <circle cx="140" cy="85" r="22" stroke="#C77DFF" strokeWidth="1.75" />
        {[
          { x1: 32, y1: 35 },
          { x1: 32, y1: 85 },
          { x1: 32, y1: 135 },
        ].map((line, i) => (
          <g key={i}>
            <line
              x1={line.x1}
              y1={line.y1}
              x2="126"
              y2="85"
              stroke="rgba(224,170,255,0.5)"
              strokeWidth="1.5"
            />
            <circle cx={line.x1} cy={line.y1} r="4.5" fill="#10002B" stroke="#C77DFF" strokeWidth="2" />
          </g>
        ))}
        <circle cx="140" cy="85" r="9" fill="#C77DFF" />
        <circle cx="140" cy="85" r="3.5" fill="#FFFFFF" />
        <line x1="158" y1="85" x2="248" y2="85" stroke="#E0AAFF" strokeWidth="1.75" strokeDasharray="4 4" />
        <circle cx="248" cy="85" r="5" fill="#FFFFFF" />
      </svg>
      <span className="relative z-10 mt-3 text-[11px] font-sans uppercase tracking-[0.2em] text-white/45 group-hover:text-[#E0AAFF] transition-colors duration-300">
        Focus → Deployment
      </span>
    </OptimizedTiltCard>
  )
}

/** Geometric SVG: Objectives Execution Matrix */
function ObjectivesMatrixVisual() {
  const nodes = [
    { cx: 70, cy: 42 },
    { cx: 140, cy: 32 },
    { cx: 210, cy: 42 },
    { cx: 70, cy: 128 },
    { cx: 140, cy: 138 },
    { cx: 210, cy: 128 },
  ]
  return (
    <OptimizedTiltCard className="group relative w-full rounded-none bg-white text-[var(--ink-dark)] border border-white/80 hover:border-[#C77DFF] hover:shadow-[0_16px_44px_rgba(199,125,255,0.28)] transition-all duration-300 p-6 sm:p-8 flex flex-col items-center justify-center shadow-xl overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-radial from-[#C77DFF]/15 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      />
      <svg
        viewBox="0 0 280 170"
        fill="none"
        aria-hidden="true"
        className="relative z-10 w-full max-w-[280px] h-auto transition-transform duration-500 group-hover:scale-[1.05]"
      >
        {nodes.map((n, idx) => (
          <line
            key={`l-${idx}`}
            x1="140"
            y1="85"
            x2={n.cx}
            y2={n.cy}
            stroke="rgba(123,44,191,0.35)"
            strokeWidth="1.5"
          />
        ))}
        <polygon
          points="70,42 140,32 210,42 210,128 140,138 70,128"
          stroke="rgba(123,44,191,0.22)"
          strokeWidth="1.25"
          strokeDasharray="4 4"
        />
        {nodes.map((n, idx) => (
          <g key={`n-${idx}`}>
            <circle cx={n.cx} cy={n.cy} r="9" fill="rgba(123,44,191,0.12)" />
            <circle cx={n.cx} cy={n.cy} r="5" fill="#FFFFFF" stroke="#7B2CBF" strokeWidth="2" />
          </g>
        ))}
        <circle cx="140" cy="85" r="16" fill="rgba(123,44,191,0.12)" stroke="#7B2CBF" strokeWidth="2" />
        <circle cx="140" cy="85" r="5.5" fill="#7B2CBF" />
      </svg>
      <span className="relative z-10 mt-3 text-[11px] font-sans uppercase tracking-[0.2em] text-[var(--ink-dark)]/50 group-hover:text-[#7B2CBF] transition-colors duration-300 font-semibold">
        6 Pillars of Execution
      </span>
    </OptimizedTiltCard>
  )
}

/** Center spine dot marker */
function SpineNode({ tone = 'light' }: { tone?: 'light' | 'lavender' | 'dark' }) {
  const toneClasses =
    tone === 'dark'
      ? 'bg-white ring-4 ring-[#240046] shadow-[0_0_16px_rgba(199,125,255,0.9)] group-hover/row:bg-[#C77DFF]'
      : tone === 'lavender'
        ? 'bg-[var(--accent-orange)] ring-4 ring-[var(--bg-surface)] shadow-[0_0_14px_rgba(123,44,191,0.5)] group-hover/row:bg-[var(--ink-dark)]'
        : 'bg-[var(--accent-orange)] ring-4 ring-[var(--bg-page)] shadow-[0_0_14px_rgba(123,44,191,0.5)] group-hover/row:bg-[var(--ink-dark)]'

  return (
    <div
      aria-hidden="true"
      className="hidden md:flex absolute left-1/2 top-20 sm:top-24 -translate-x-1/2 z-20 items-center justify-center"
    >
      <span
        className={`w-3.5 h-3.5 rounded-full transition-all duration-300 group-hover/row:scale-125 group-hover/row:shadow-[0_0_24px_rgba(199,125,255,0.95)] ${toneClasses}`}
      />
    </div>
  )
}

export default function About() {
  const timelineRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ['start 35%', 'end 80%'],
  })
  const spineScaleY = useSpring(scrollYProgress, {
    stiffness: 160,
    damping: 26,
    restDelta: 0.001,
  })

  return (
    <div className="min-h-screen w-full bg-[var(--bg-page)] text-[var(--text-primary)] relative font-sans">
      {/* ── TOP HEADER BAND ── */}
      <div className="w-full bg-[var(--ink-dark)] text-white relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-0 w-[420px] h-[420px] rounded-full bg-[#7B2CBF]/25 blur-3xl"
        />
        <header className="relative z-10 pt-16 sm:pt-24 pb-12 sm:pb-16 px-6 sm:px-10 max-w-[1240px] mx-auto text-left">
          <span className="inline-block text-[11px] font-sans font-semibold uppercase tracking-[0.22em] text-[#E0AAFF] mb-4">
            NED University • AI Research Lab
          </span>
          <TitleReveal
            as="h1"
            waitForPreloader
            hoverColor="#C77DFF"
            className="font-head font-extrabold text-4xl sm:text-5xl lg:text-6xl text-white tracking-tight mb-4"
          >
            About AIR Lab
          </TitleReveal>

          <BlurReveal
            as="p"
            waitForPreloader
            delay={0.14}
            className="text-lg sm:text-2xl text-white/85 leading-snug font-normal max-w-3xl"
          >
            Research-grade minds. Production-ready systems. Built for Pakistan.
          </BlurReveal>
        </header>
      </div>

      {/* ── CENTER-SPINE TWO-COLUMN EDITORIAL FLOW ── */}
      <div ref={timelineRef} className="relative w-full">
        {/* Continuous center spine + scroll-driven glowing progress line */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-[var(--accent-orange)]/25 z-10 pointer-events-none"
        >
          <motion.div
            style={{ scaleY: spineScaleY, transformOrigin: 'top' }}
            className="w-full h-full bg-gradient-to-b from-[#C77DFF] via-[var(--accent-orange)] to-[#3C096C] shadow-[0_0_12px_rgba(123,44,191,0.45)]"
          />
        </div>

        {/* ── ROW 1: ABOUT (Crisp White Band — Left: Diagram | Right: Header + Content) ── */}
        <motion.section
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="group/row relative w-full bg-[var(--bg-page)] text-[var(--text-primary)] py-16 sm:py-24 border-b border-[var(--border-hairline)]"
        >
          <SpineNode tone="light" />
          <div className="max-w-[1240px] mx-auto px-6 sm:px-10 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="md:pr-4 order-2 md:order-1">
              <ResearchFlowVisual />
            </div>

            <div className="md:pl-4 space-y-4 text-left order-1 md:order-2">
              <TitleReveal
                as="h2"
                waitForPreloader
                hoverColor="var(--accent-orange)"
                className="font-head font-extrabold text-3xl sm:text-4xl lg:text-[42px] text-[var(--text-primary)] tracking-tight"
              >
                About
              </TitleReveal>
              <BlurReveal
                as="p"
                waitForPreloader
                delay={0.08}
                className="text-[15.5px] sm:text-[17px] text-[var(--text-muted)] leading-relaxed font-normal"
              >
                AIR Lab, the artificial intelligence research lab at NED University, turns cutting-edge research into production-ready systems. We build models, fine-tune and optimize open-source ones to run on local hardware, and gather the data to teach them Pakistan’s languages and realities.
              </BlurReveal>
              <BlurReveal
                as="p"
                waitForPreloader
                delay={0.18}
                className="text-[15.5px] sm:text-[17px] text-[var(--text-muted)] leading-relaxed font-normal"
              >
                Our work spans cybersecurity and adversarial AI, small language models, computer vision, natural language processing, speech-based agents, and agentic AI. We don’t stop at papers and prototypes. We engineer, test, and deploy systems that people and institutions can use. Every project begins with one question: what do the people of Pakistan need?
              </BlurReveal>
            </div>
          </div>
        </motion.section>

        {/* ── ROW 2: VISION (Soft Lavender Band — Left: Header + Content | Right: Diagram) ── */}
        <motion.section
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="group/row relative w-full bg-[var(--bg-surface)] text-[var(--text-primary)] py-16 sm:py-24 border-b border-[var(--border-hairline)]"
        >
          <SpineNode tone="lavender" />
          <div className="max-w-[1240px] mx-auto px-6 sm:px-10 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="md:text-right md:pr-4 space-y-4">
              <TitleReveal
                as="h2"
                hoverColor="var(--accent-orange)"
                className="font-head font-extrabold text-3xl sm:text-4xl lg:text-[42px] text-[var(--text-primary)] tracking-tight"
              >
                Vision
              </TitleReveal>
              <BlurReveal
                as="p"
                delay={0.1}
                className="text-[16px] sm:text-[18px] text-[var(--text-muted)] leading-relaxed font-normal"
              >
                To make Pakistan a builder of AI, not just a consumer of it, with solutions designed around our people, our languages, and our values.
              </BlurReveal>
            </div>

            <div className="md:pl-4">
              <VisionOrbitVisual />
            </div>
          </div>
        </motion.section>

        {/* ── ROW 3: MISSION (Deep Royal Violet Band — Left: Diagram | Right: Header + Content) ── */}
        <motion.section
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="group/row relative w-full bg-gradient-to-br from-[#10002B] via-[#240046] to-[#3C096C] text-white py-16 sm:py-24 overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 left-1/4 w-[380px] h-[380px] rounded-full bg-[#C77DFF]/15 blur-3xl"
          />
          <SpineNode tone="dark" />
          <div className="relative z-10 max-w-[1240px] mx-auto px-6 sm:px-10 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="md:pr-4 order-2 md:order-1">
              <MissionConvergenceVisual />
            </div>

            <div className="md:pl-4 text-left space-y-4 order-1 md:order-2">
              <TitleReveal
                as="h2"
                hoverColor="#C77DFF"
                className="font-head font-extrabold text-3xl sm:text-4xl lg:text-[42px] text-white tracking-tight"
              >
                Mission
              </TitleReveal>
              <BlurReveal
                as="p"
                delay={0.1}
                className="text-[16px] sm:text-[18px] text-white/90 leading-relaxed font-normal"
              >
                To conduct cutting-edge AI research and turn it into secure, production-ready systems built around the languages, data, and needs of the people of Pakistan, while training the next generation of AI researchers and engineers.
              </BlurReveal>
            </div>
          </div>
        </motion.section>

        {/* ── ROW 4: AIMS (Crisp White Band — Left: Header + Cards | Right: Diagram) ── */}
        <motion.section
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="group/row relative w-full bg-[var(--bg-page)] text-[var(--text-primary)] py-16 sm:py-24 border-b border-[var(--border-hairline)]"
        >
          <SpineNode tone="light" />
          <div className="max-w-[1240px] mx-auto px-6 sm:px-10 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="md:pr-4 space-y-5 text-left">
              <TitleReveal
                as="h2"
                hoverColor="var(--accent-orange)"
                className="font-head font-extrabold text-3xl sm:text-4xl lg:text-[42px] text-[var(--text-primary)] tracking-tight md:text-right"
              >
                Aims
              </TitleReveal>
              <div className="space-y-3.5">
                {AIMS.map((aim, idx) => (
                  <OptimizedTiltCard
                    key={aim}
                    className="group w-full text-left p-5 sm:p-6 rounded-none border bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:bg-[var(--ink-dark)] hover:border-[var(--ink-dark)] hover:text-white hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 flex items-start gap-3.5"
                  >
                    <span className="w-2 h-2 rounded-full mt-2 shrink-0 bg-[var(--accent-orange)] group-hover:bg-[#C77DFF] group-hover:scale-125 transition-all duration-300" />
                    <BlurReveal
                      as="span"
                      delay={idx * 0.06}
                      className="text-[15px] sm:text-[16px] leading-relaxed font-normal text-[var(--text-muted)] group-hover:text-white transition-colors duration-300"
                    >
                      {aim}
                    </BlurReveal>
                  </OptimizedTiltCard>
                ))}
              </div>
            </div>

            <div className="md:pl-4">
              <AimsTargetVisual />
            </div>
          </div>
        </motion.section>

        {/* ── ROW 5: OBJECTIVES (Soft Lavender Band — Left: Diagram | Right: Header + Cards) ── */}
        <motion.section
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="group/row relative w-full bg-[var(--bg-surface)] text-[var(--text-primary)] py-16 sm:py-28"
        >
          <SpineNode tone="lavender" />
          <div className="max-w-[1240px] mx-auto px-6 sm:px-10 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="md:pr-4 order-2 md:order-1">
              <ObjectivesMatrixVisual />
            </div>

            <div className="md:pl-4 space-y-5 text-left order-1 md:order-2">
              <TitleReveal
                as="h2"
                hoverColor="var(--accent-orange)"
                className="font-head font-extrabold text-3xl sm:text-4xl lg:text-[42px] text-[var(--text-primary)] tracking-tight"
              >
                Objectives
              </TitleReveal>
              <div className="space-y-3.5">
                {OBJECTIVES.map((obj, idx) => (
                  <OptimizedTiltCard
                    key={obj}
                    className="group w-full text-left p-5 rounded-none border bg-white text-[var(--text-primary)] border-[var(--border-hairline)] hover:bg-[var(--ink-dark)] hover:border-[var(--ink-dark)] hover:text-white hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 flex items-start gap-3.5"
                  >
                    <span className="w-2 h-2 rounded-full mt-2 shrink-0 bg-[var(--accent-orange)] group-hover:bg-[#C77DFF] group-hover:scale-125 transition-all duration-300" />
                    <BlurReveal
                      as="span"
                      delay={idx * 0.05}
                      className="text-[14.5px] sm:text-[15.5px] leading-relaxed font-normal text-[var(--text-muted)] group-hover:text-white transition-colors duration-300"
                    >
                      {obj}
                    </BlurReveal>
                  </OptimizedTiltCard>
                ))}
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  )
}
