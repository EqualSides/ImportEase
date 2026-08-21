"use client";

import { useCallback, useRef } from "react";
import { highlightComments } from "@/lib/highlightComments";

/**
 * A plain <textarea> can't render colored text, so this overlays an
 * invisible (color: transparent) textarea on top of a highlighted <pre>
 * with identical box metrics — typing/selecting/scrolling all happen on
 * the real textarea as normal, while the colored text shows through from
 * behind it. Scroll position is synced on every scroll event so the two
 * layers never drift apart.
 */

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  large?: boolean;
  autoFocus?: boolean;
}

export default function CodeTextarea({ id, value, onChange, disabled, placeholder, large, autoFocus }: Props) {
  const highlightRef = useRef<HTMLPreElement>(null);

  const syncScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = e.currentTarget.scrollTop;
      highlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }, []);

  return (
    <div className={large ? "code-textarea-wrap code-textarea-wrap-large" : "code-textarea-wrap"}>
      <pre ref={highlightRef} className="code-textarea-layer code-textarea-highlight" aria-hidden="true">
        <code dangerouslySetInnerHTML={{ __html: highlightComments(value) + "\n" }} />
      </pre>
      <textarea
        id={id}
        className="code-textarea-layer code-textarea-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck={false}
        autoFocus={autoFocus}
      />
    </div>
  );
}
