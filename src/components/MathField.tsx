import { useEffect, useRef } from "react";
import { MathfieldElement } from "mathlive";

MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;
MathfieldElement.keypressSound = null;
MathfieldElement.plonkSound = null;

interface MathAnswerInputProps {
  value: string;
  onChange: (latex: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  label: string;
  matrixShape?: { rows: number; cols: number };
}

export function MathAnswerInput({ value, onChange, onSubmit, disabled = false, readOnly = false, label, matrixShape }: MathAnswerInputProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);

  onChangeRef.current = onChange;
  onSubmitRef.current = onSubmit;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const field = new MathfieldElement({
      mathVirtualKeyboardPolicy: "auto",
      defaultMode: "math"
    });
    field.smartFence = true;
    field.smartMode = true;
    field.setAttribute("aria-label", label);
    field.setAttribute("placeholder", "\\text{Enter your final answer}");
    field.className = "math-answer-field";
    field.value = value;

    const handleInput = () => onChangeRef.current(field.getValue("latex"));
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onSubmitRef.current();
      }
    };
    field.addEventListener("input", handleInput);
    field.addEventListener("change", handleInput);
    field.addEventListener("keydown", handleKeyDown, true);
    host.append(field);
    fieldRef.current = field;

    return () => {
      field.removeEventListener("input", handleInput);
      field.removeEventListener("change", handleInput);
      field.removeEventListener("keydown", handleKeyDown, true);
      field.remove();
      fieldRef.current = null;
    };
  }, [label]);

  useEffect(() => {
    const field = fieldRef.current;
    if (field && field.value !== value) field.value = value;
  }, [value]);

  useEffect(() => {
    if (fieldRef.current) fieldRef.current.disabled = disabled;
  }, [disabled]);

  useEffect(() => {
    if (fieldRef.current) fieldRef.current.readOnly = readOnly;
  }, [readOnly]);

  function insertMatrix() {
    const field = fieldRef.current;
    if (!field || !matrixShape || disabled || readOnly) return;
    const template = `\\begin{bmatrix}${Array.from({ length: matrixShape.rows }, () =>
      Array.from({ length: matrixShape.cols }, () => "\\placeholder{}").join("&")
    ).join("\\\\")}\\end{bmatrix}`;
    field.focus();
    field.insert(template);
    onChange(field.getValue("latex"));
  }

  return <div className="math-answer-control">
    <div ref={hostRef} className="math-answer-host" />
    {matrixShape && <button className="matrix-insert-button" type="button" onClick={insertMatrix} disabled={disabled || readOnly}>
      Insert {matrixShape.rows} × {matrixShape.cols} matrix
    </button>}
  </div>;
}

interface StaticMathProps {
  latex: string;
  label?: string;
  className?: string;
  fitToContainer?: boolean;
}

export function StaticMath({ latex, label, className = "", fitToContainer = false }: StaticMathProps) {
  const hostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const field = new MathfieldElement();
    field.readOnly = true;
    field.value = latex;
    field.className = `static-math ${className}`.trim();
    host.append(field);
    const spokenMath = field.getValue("spoken").trim();
    field.setAttribute("aria-label", label ? `${label} ${spokenMath || latex}` : spokenMath || latex);
    if (!fitToContainer) return () => field.remove();

    const clauses = latex.split(/,\s*\\quad\s*/);
    const multiline = `\\begin{gathered}${clauses.join(",\\\\")}\\end{gathered}`;
    let singleLineWidth = 0;
    let displayedLatex = latex;
    let frame = 0;
    let disposed = false;

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };

    const fit = () => {
      const content = field.shadowRoot?.querySelector<HTMLElement>("[part=content]");
      const expression = content?.firstElementChild;
      if (!content || !expression || host.clientWidth === 0) return;

      const preferredSize = parseFloat(getComputedStyle(host).fontSize);
      const currentSize = parseFloat(getComputedStyle(field).fontSize);
      const widthPerEm = expression.getBoundingClientRect().width / currentSize;
      if (widthPerEm === 0) return;
      const contentStyle = getComputedStyle(content);
      const padding = field.clientWidth - content.clientWidth +
        parseFloat(contentStyle.paddingLeft) + parseFloat(contentStyle.paddingRight);
      const available = Math.max(1, host.clientWidth - padding);
      if (displayedLatex === latex) singleLineWidth = widthPerEm;
      const nextLatex = clauses.length > 1 && singleLineWidth * preferredSize * 0.85 > available
        ? multiline : latex;

      if (nextLatex !== displayedLatex) {
        displayedLatex = nextLatex;
        field.value = nextLatex;
        schedule();
        return;
      }

      const size = Math.floor(Math.min(preferredSize, (available - 1) / widthPerEm) * 10) / 10;
      if (Math.abs(size - currentSize) > 0.05) field.style.fontSize = `${size}px`;
    };

    const fontsChanged = () => {
      if (disposed) return;
      displayedLatex = latex;
      field.value = latex;
      schedule();
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(host);
    observer.observe(field);
    window.addEventListener("resize", schedule);
    document.fonts.addEventListener("loadingdone", fontsChanged);
    void document.fonts.ready.then(fontsChanged);
    schedule();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      document.fonts.removeEventListener("loadingdone", fontsChanged);
      field.remove();
    };
  }, [className, fitToContainer, label, latex]);

  return <span ref={hostRef} className={`static-math-host${fitToContainer ? " responsive-math" : ""}`} />;
}

