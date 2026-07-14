import { motion } from 'framer-motion';

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const markVariants = {
  hidden: { opacity: 0, scale: 0.6, rotate: -8 },
  show: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { type: 'spring' as const, stiffness: 180, damping: 16 },
  },
};

const wordVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

/** Premium animated wordmark for the login screen: a sweeping "wave" arc (aceno) inside a glass emblem. */
export function AcenoLogo() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center gap-4"
    >
      <motion.div
        variants={markVariants}
        className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/70 shadow-lg shadow-primary/30"
      >
        <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 to-transparent" />
        <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none">
          <motion.path
            d="M10 30c4-10 10-16 14-16s6 10 10 4"
            stroke="white"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.35, ease: 'easeInOut' }}
          />
          <motion.circle
            cx="34"
            cy="16"
            r="2.4"
            fill="white"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.05, type: 'spring', stiffness: 300, damping: 12 }}
          />
        </svg>
      </motion.div>

      <div className="flex flex-col items-center">
        <motion.div variants={wordVariants} className="flex items-baseline gap-0.5">
          {'Aceno'.split('').map((ch, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.05, duration: 0.35, ease: 'easeOut' }}
              className="text-3xl font-semibold tracking-tight bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent"
            >
              {ch}
            </motion.span>
          ))}
        </motion.div>
        <motion.div
          variants={wordVariants}
          className="mt-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground"
        >
          <span className="h-px w-4 bg-border" />
          Ladonna
          <span className="h-px w-4 bg-border" />
        </motion.div>
      </div>
    </motion.div>
  );
}
