import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function SaveProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(timer);
          return prev;
        }
        return prev + Math.random() * 15;
      });
    }, 100);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-1 bg-muted overflow-hidden">
      <div
        className={cn(
          'h-full bg-primary transition-all duration-150 ease-out',
          'animate-pulse'
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
