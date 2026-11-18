"use client";
import React, { useState } from "react";
import {
  motion,
  useTransform,
  AnimatePresence,
  useMotionValue,
  useSpring,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

export const AnimatedTooltip = ({
  items,
  className,
}: {
  items: {
    id: number | string;
    name: string;
    designation: string;
    image: string;
  }[];
  className?: string;
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | string | null>(null);
  const springConfig = { stiffness: 100, damping: 5 };
  const x = useMotionValue(0);
  const rotate = useSpring(
    useTransform(x, [-100, 100], [-45, 45]),
    springConfig
  );
  const translateX = useSpring(
    useTransform(x, [-100, 100], [-50, 50]),
    springConfig
  );
  const handleMouseMove = (event: React.MouseEvent<HTMLImageElement>) => {
    const halfWidth = event.currentTarget.offsetWidth / 2;
    x.set(event.nativeEvent.offsetX - halfWidth);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {items.map((item) => (
        <div
          className="-mr-4 relative group"
          key={item.id}
          onMouseEnter={() => setHoveredIndex(item.id)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <AnimatePresence mode="popLayout">
            {hoveredIndex === item.id && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    type: "spring",
                    stiffness: 260,
                    damping: 10,
                  },
                }}
                exit={{ opacity: 0, y: 20, scale: 0.6 }}
                style={{
                  translateX,
                  rotate,
                  whiteSpace: "nowrap",
                }}
                className="absolute -top-16 -left-1/2 translate-x-1/2 flex text-xs flex-col items-center justify-center rounded-md bg-[var(--ink-dark)] z-50 shadow-xl px-4 py-2 border border-white/15"
              >
                <div className="absolute inset-x-10 z-30 w-[20%] -bottom-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent h-px" />
                <div className="absolute left-10 w-[40%] z-30 -bottom-px bg-gradient-to-r from-transparent via-sky-500 to-transparent h-px" />
                <div className="font-bold text-white relative z-30 text-base">
                  {item.name}
                </div>
                <div className="text-white/75 text-xs">
                  {item.designation}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <img
            onMouseMove={handleMouseMove}
            height={100}
            width={100}
            src={item.image}
            alt={item.name}
            className="object-cover !m-0 !p-0 object-top rounded-full h-14 w-14 border-2 group-hover:scale-105 group-hover:z-30 border-white relative transition duration-500"
          />
        </div>
      ))}
    </div>
  );
};

interface HoverDetailTooltipProps {
  visible: boolean;
  mouseX: MotionValue<number>;
  title: string;
  subtitle?: string | null;
  className?: string;
}

/**
 * Spring-animated floating tooltip that tracks horizontal cursor offset
 * without altering the underlying card layout.
 */
export const HoverDetailTooltip: React.FC<HoverDetailTooltipProps> = ({
  visible,
  mouseX,
  title,
  subtitle,
  className,
}) => {
  const springConfig = { stiffness: 120, damping: 12 };
  const rotate = useSpring(
    useTransform(mouseX, [-140, 140], [-14, 14]),
    springConfig
  );
  const translateX = useSpring(
    useTransform(mouseX, [-140, 140], [-28, 28]),
    springConfig
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.72 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              type: "spring",
              stiffness: 280,
              damping: 16,
            },
          }}
          exit={{ opacity: 0, y: 12, scale: 0.75, transition: { duration: 0.15 } }}
          style={{
            translateX,
            rotate,
          }}
          className={cn(
            "pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center justify-center rounded-xl bg-[var(--ink-dark)] text-white border border-white/15 shadow-2xl px-4 py-2 whitespace-nowrap max-w-[280px]",
            className
          )}
        >
          <div className="absolute inset-x-8 z-30 w-[25%] -bottom-px bg-gradient-to-r from-transparent via-emerald-400 to-transparent h-px" />
          <div className="absolute left-8 w-[45%] z-30 -bottom-px bg-gradient-to-r from-transparent via-sky-400 to-transparent h-px" />
          <div className="font-semibold text-white relative z-30 text-xs sm:text-[13px] truncate max-w-full">
            {title}
          </div>
          {subtitle && (
            <div className="text-white/75 text-[11px] relative z-30 truncate max-w-full mt-0.5">
              {subtitle}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
