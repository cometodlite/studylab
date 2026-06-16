'use client';

import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Props {
  text: string;
  block?: boolean;
}

export default function MathText({ text, block = false }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = renderMixed(text);
  }, [text]);

  return block
    ? <div ref={ref as React.RefObject<HTMLDivElement>} className="my-2" />
    : <span ref={ref} />;
}

function renderKatex(expr: string, display: boolean): string {
  try {
    return katex.renderToString(expr.trim(), { displayMode: display, throwOnError: false });
  } catch {
    return `<span class="text-red-400">${expr}</span>`;
  }
}

function renderMixed(text: string): string {
  // $$...$$ 블록 수식 ([\s\S] instead of . with s flag for ES2017 compat)
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr: string) => renderKatex(expr, true));
  // $...$ 인라인 수식
  text = text.replace(/\$([^$\n]+?)\$/g, (_, expr: string) => renderKatex(expr, false));
  return text;
}
