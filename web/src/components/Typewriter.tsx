import { useEffect, useState } from 'react';

interface TypewriterProps {
  text: string;
  done: boolean;
  onProgress?: () => void;
  onComplete: () => void;
}

const FRAMES_TO_CATCH_UP = 45;

export function Typewriter({ text, done, onProgress, onComplete }: TypewriterProps) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (shown >= text.length) {
      if (done) onComplete();
      return;
    }

    const frame = requestAnimationFrame(() => {
      const step = Math.max(1, Math.ceil((text.length - shown) / FRAMES_TO_CATCH_UP));
      setShown((current) => Math.min(text.length, current + step));
      onProgress?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [shown, text, done, onProgress, onComplete]);

  return (
    <>
      {text.slice(0, shown)}
      <span className="cursor" />
    </>
  );
}
