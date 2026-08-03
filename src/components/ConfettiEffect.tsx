import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  angle: number;
  spin: number;
}

interface ConfettiEffectProps {
  active: boolean;
  color: string;
  count?: number;
}

export const ConfettiEffect: React.FC<ConfettiEffectProps> = ({ active, color, count = 16 }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    let animFrameId: number;
    let timer: NodeJS.Timeout;

    if (active) {
      const newParticles: Particle[] = Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
        const distance = 40 + Math.random() * 50;
        return {
          id: Date.now() + i,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 10, // slight upward bias
          size: 3 + Math.random() * 4,
          color: Math.random() > 0.4 ? color : '#ffffff',
          delay: Math.random() * 0.1,
          duration: 0.6 + Math.random() * 0.8,
          angle: angle,
          spin: (Math.random() - 0.5) * 360,
        };
      });

      animFrameId = requestAnimationFrame(() => {
        setParticles(newParticles);
      });

      // Auto clear after animation completes
      timer = setTimeout(() => {
        animFrameId = requestAnimationFrame(() => {
          setParticles([]);
        });
      }, 1600);
    } else {
      animFrameId = requestAnimationFrame(() => {
        setParticles([]);
      });
    }

    return () => {
      cancelAnimationFrame(animFrameId);
      if (timer) clearTimeout(timer);
    };
  }, [active, color, count]);

  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center overflow-visible">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.5, rotate: 0 }}
            animate={{
              x: p.x,
              y: p.y,
              opacity: 0,
              scale: [1, 1.2, 0],
              rotate: p.spin,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: [0.1, 0.8, 0.3, 1], // snappy outward velocity then slow decelerating drag
            }}
            className="absolute rounded-sm shadow-[0_0_8px_currentColor]"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              color: p.color,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ConfettiEffect;
