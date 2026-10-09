import { Variants } from 'motion/react';

// Centralised Motion Architecture (Phase 4 Spec)

// Universal Spring System Prototyping (V3 Motion Engine)
export const SOFT_SPRING = { type: 'spring', stiffness: 120, damping: 20 };
export const MEDIUM_SPRING = { type: 'spring', stiffness: 220, damping: 22 };
export const FAST_SPRING = { type: 'spring', stiffness: 350, damping: 25 };
export const CRITICAL_SPRING = { type: 'spring', stiffness: 480, damping: 28 };

// Interactive Micro-motions
export const hoverLiftAndTap = {
  whileHover: {
    y: -2,
    scale: 1.015,
    filter: 'brightness(1.03)',
    transition: FAST_SPRING,
  },
  whileTap: {
    scale: 0.97,
    y: 0,
    transition: { type: 'spring', stiffness: 500, damping: 15 }
  }
};

export const hoverShiftAndTap = {
  whileHover: {
    scale: 1.03,
    y: -1,
    transition: FAST_SPRING,
  },
  whileTap: {
    scale: 0.97,
    y: 0.5,
    transition: { type: 'spring', stiffness: 500, damping: 15 }
  }
};

export const buttonPress = {
  whileHover: {
    scale: 1.01,
    y: -1,
    filter: 'brightness(1.04)',
    transition: FAST_SPRING,
  },
  whileTap: {
    scale: 0.96,
    y: 0.5,
    transition: { type: 'spring', stiffness: 500, damping: 16 }
  }
};

export const chatItemMotion = {
  whileHover: {
    scale: 1.008,
    x: 1.5,
    transition: FAST_SPRING,
  },
  whileTap: {
    scale: 0.99,
    transition: { type: 'spring', stiffness: 400, damping: 20 }
  }
};

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

export const fadeOut: Variants = {
  initial: { opacity: 1 },
  animate: { opacity: 0, transition: { duration: 0.12 } },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { type: 'spring', damping: 25, stiffness: 280 }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: 0.18, ease: 'easeOut' }
  },
};

export const scaleOut: Variants = {
  initial: { opacity: 1, scale: 1 },
  animate: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

export const springEnter: Variants = {
  initial: { opacity: 0, scale: 0.93, y: 15 },
  animate: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: 'spring', damping: 24, stiffness: 280 }
  },
  exit: { 
    opacity: 0, 
    scale: 0.93, 
    y: 12,
    transition: { duration: 0.18, ease: 'easeOut' }
  },
};

export const springExit: Variants = {
  initial: { opacity: 1, scale: 1, y: 0 },
  animate: { opacity: 0, scale: 0.93, y: 12, transition: { duration: 0.15 } },
};

export const glassBloom: Variants = {
  initial: { opacity: 0, filter: 'blur(10px)', scale: 0.97 },
  animate: { 
    opacity: 1, 
    filter: 'blur(0px)', 
    scale: 1,
    transition: { type: 'spring', damping: 25, stiffness: 180 }
  },
  exit: { 
    opacity: 0, 
    filter: 'blur(8px)', 
    scale: 0.97,
    transition: { duration: 0.22, ease: 'easeInOut' }
  },
};

export const bentoContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

export const bentoItemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 220, damping: 22 }
  }
};
