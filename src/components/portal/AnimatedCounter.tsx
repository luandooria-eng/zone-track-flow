import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  className?: string;
}

export function AnimatedCounter({ value, className }: AnimatedCounterProps) {
  const spring = useSpring(0, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString('pt-BR'));
  const [text, setText] = useState(value.toLocaleString('pt-BR'));
  const prevValue = useRef(value);

  useEffect(() => {
    spring.set(value);
    const unsub = display.on('change', (v) => setText(v));
    return unsub;
  }, [value, spring, display]);

  const changed = prevValue.current !== value;
  prevValue.current = value;

  return (
    <motion.span
      className={className}
      animate={changed ? { scale: [1, 1.08, 1] } : {}}
      transition={{ duration: 0.5 }}
    >
      {text}
    </motion.span>
  );
}
