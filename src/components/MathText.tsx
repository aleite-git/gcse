'use client';

import { useEffect, useRef } from 'react';
import renderMathInElement from 'katex/contrib/auto-render';

type MathTextProps = {
  text?: string;
  className?: string;
  block?: boolean;
};

export function MathText({ text, className, block = false }: MathTextProps) {
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const divRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = block ? divRef.current : spanRef.current;
    if (!element) return;

    element.textContent = text || '';
    renderMathInElement(element, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true },
      ],
      throwOnError: false,
    });
  }, [text]);

  if (block) {
    return <div ref={divRef} className={className} />;
  }

  return <span ref={spanRef} className={className} />;
}
