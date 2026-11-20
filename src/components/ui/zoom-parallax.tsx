'use client';

import { useScroll, useTransform, motion } from 'framer-motion';
import { useRef } from 'react';

export interface ZoomParallaxImage {
	src: string;
	alt?: string;
	title?: string;
	category?: string;
}

export interface ZoomParallaxProps {
	/** Array of images to be displayed in the parallax effect (max 7 images per stage) */
	images: ZoomParallaxImage[];
	/** Optional callback when an image card is clicked */
	onImageClick?: (index: number) => void;
}

const SLOT_CLASSES: Record<number, string> = {
	0: '',
	1: '[&>div]:!-top-[30vh] [&>div]:!left-[5vw] [&>div]:!h-[30vh] [&>div]:!w-[35vw]',
	2: '[&>div]:!-top-[10vh] [&>div]:!-left-[25vw] [&>div]:!h-[45vh] [&>div]:!w-[20vw]',
	3: '[&>div]:!left-[27.5vw] [&>div]:!h-[25vh] [&>div]:!w-[25vw]',
	4: '[&>div]:!top-[27.5vh] [&>div]:!left-[5vw] [&>div]:!h-[25vh] [&>div]:!w-[20vw]',
	5: '[&>div]:!top-[27.5vh] [&>div]:!-left-[22.5vw] [&>div]:!h-[25vh] [&>div]:!w-[30vw]',
	6: '[&>div]:!top-[22.5vh] [&>div]:!left-[25vw] [&>div]:!h-[15vh] [&>div]:!w-[15vw]',
};

export function ZoomParallax({ images, onImageClick }: ZoomParallaxProps) {
	const container = useRef<HTMLDivElement | null>(null);
	const { scrollYProgress } = useScroll({
		target: container,
		offset: ['start start', 'end end'],
	});

	const scale4 = useTransform(scrollYProgress, [0, 1], [1, 4]);
	const scale5 = useTransform(scrollYProgress, [0, 1], [1, 5]);
	const scale6 = useTransform(scrollYProgress, [0, 1], [1, 6]);
	const scale8 = useTransform(scrollYProgress, [0, 1], [1, 8]);
	const scale9 = useTransform(scrollYProgress, [0, 1], [1, 9]);

	const scales = [scale4, scale5, scale6, scale5, scale6, scale8, scale9];

	// Skip rendering if category/images list is empty
	const visibleImages = (images || []).filter((img) => Boolean(img?.src)).slice(0, 7);
	if (visibleImages.length === 0) {
		return null;
	}

	// Adjust scroll track height proportionally when a category has fewer images
	const trackHeightClass =
		visibleImages.length === 1
			? 'h-[200vh]'
			: visibleImages.length <= 3
				? 'h-[240vh]'
				: 'h-[300vh]';

	return (
		<div ref={container} className={`relative w-full ${trackHeightClass}`}>
			<div className="sticky top-0 h-screen w-full overflow-hidden">
				{visibleImages.map(({ src, alt, title, category }, index) => {
					const scale = scales[index % scales.length];
					const slotClass = SLOT_CLASSES[index] || '';

					return (
						<motion.div
							key={`${src}-${index}`}
							style={{ scale }}
							className={`absolute top-0 flex h-full w-full items-center justify-center pointer-events-none ${slotClass}`}
						>
							<div
								onClick={onImageClick ? () => onImageClick(index) : undefined}
								role={onImageClick ? 'button' : undefined}
								tabIndex={onImageClick ? 0 : undefined}
								onKeyDown={
									onImageClick
										? (e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													onImageClick(index);
												}
											}
										: undefined
								}
								className={`group relative h-[25vh] w-[25vw] overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-lg pointer-events-auto ${
									onImageClick ? 'cursor-pointer' : ''
								}`}
							>
								<img
									src={src || '/placeholder.svg'}
									alt={alt || title || `Parallax image ${index + 1}`}
									className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
									loading={index < 3 ? 'eager' : 'lazy'}
									decoding="async"
								/>
								{(title || category) && (
									<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2.5 sm:p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
										{category && (
											<span className="inline-block rounded-full bg-black/60 px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-white backdrop-blur-xs">
												{category}
											</span>
										)}
										{title && (
											<p className="mt-0.5 line-clamp-1 font-head text-[11px] sm:text-xs font-semibold text-white">
												{title}
											</p>
										)}
									</div>
								)}
							</div>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}

export default ZoomParallax;
