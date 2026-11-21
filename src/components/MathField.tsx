import { useEffect, useRef } from "react";
import { convertLatexToSpeakableText, MathfieldElement } from "mathlive";

MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;
MathfieldElement.keypressSound = null;
MathfieldElement.plonkSound = null;

interface MathAnswerInputProps {
  value: string;
  onChange: (latex: string) => void;
  onSubmit: (latex: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  label: string;
  id?: string;
  placeholder?: string;
  matrixShape?: { rows: number; cols: number };
}

export function MathAnswerInput({ value, onChange, onSubmit, disabled = false, readOnly = false, label, id, placeholder = "\\text{Enter your final answer}", matrixShape }: MathAnswerInputProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  const lastEmitted = useRef(value);
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
    if (id) field.id = id;
    field.setAttribute("aria-label", label);
    if (placeholder) field.setAttribute("placeholder", placeholder);
    field.className = "math-answer-field";
    field.value = value;
    lastEmitted.current = value;

    const handleInput = () => {
      queueMicrotask(() => {
        if (fieldRef.current !== field) return;
        const current = field.getValue("latex");
        if (current === lastEmitted.current) return;
        lastEmitted.current = current;
        onChangeRef.current(current);
      });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.isComposing) return;
      const target = event.composedPath()[0];
      if (target instanceof HTMLElement && target.closest("button, [role=button]")) return;
      event.preventDefault();
      event.stopPropagation();
      onSubmitRef.current(field.getValue("latex"));
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
  }, [label, id, placeholder]);

  useEffect(() => {
    const field = fieldRef.current;
    if (field && lastEmitted.current !== value) {
      lastEmitted.current = value;
      if (field.value !== value) field.value = value;
    }
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
    lastEmitted.current = field.getValue("latex");
    onChange(lastEmitted.current);
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
  description?: string;
  className?: string;
  fitToContainer?: boolean;
  scrollIfWide?: boolean;
}

function describeMatrices(latex: string): string {
  return latex.replace(/\\begin\{bmatrix\}([\s\S]*?)\\end\{bmatrix\}/g, (_match, body: string) => {
    const rows = body.split(/\\\\/).map((row) => row.split("&"));
    const entries = rows.flatMap((row, rowIndex) => row.map((entry, columnIndex) =>
      `row ${rowIndex + 1} column ${columnIndex + 1} ${entry}`));
    return `matrix ${rows.length} by ${rows[0]?.length ?? 0}, ${entries.join(", ")}`;
  }).replace(/c_\{(\d)(\d)\}/g, (_match, row: string, column: string) => `row ${row} column ${column}`)
    .replace(/\\quad/g, ", ").replace(/\\/g, " ").replace(/[{}]/g, " ").replace(/\s+/g, " ").trim();
}

function spokenDescription(latex: string): string {
  try {
    if (latex.includes("\\begin{bmatrix}") || /c_\{\d\d\}/.test(latex)) return describeMatrices(latex);
    return latex.replace(/^\\begin\{gathered\}|\\end\{gathered\}$/g, "").split("\\\\")
      .map((line) => convertLatexToSpeakableText(line).trim()).join(" ").trim() || latex;
  } catch {
    // A saved answer can contain notation that the speech converter cannot describe.
    return latex;
  }
}

export function StaticMath({ latex, label, description, className = "", fitToContainer = false, scrollIfWide = false }: StaticMathProps) {
  const hostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const field = new MathfieldElement();
    field.readOnly = true;
    field.value = latex;
    field.className = `static-math ${className}`.trim();
    host.append(field);
    const spokenMath = description || spokenDescription(latex);
    field.setAttribute("aria-label", label ? `${label} ${spokenMath}` : spokenMath);
    const updateScrollFocus = () => {
      if (host.scrollWidth > host.clientWidth + 1) host.tabIndex = 0;
      else host.removeAttribute("tabindex");
    };
    if (scrollIfWide) field.tabIndex = -1;
    if (scrollIfWide && !fitToContainer) {
      const observer = new ResizeObserver(updateScrollFocus);
      observer.observe(host);
      observer.observe(field);
      return () => {
        observer.disconnect();
        host.removeAttribute("tabindex");
        field.remove();
      };
    }
    if (!fitToContainer) return () => field.remove();

    const gathered = latex.startsWith("\\begin{gathered}") && latex.endsWith("\\end{gathered}");
    const body = gathered ? latex.slice("\\begin{gathered}".length, -"\\end{gathered}".length) : latex;
    const clauses = gathered && !scrollIfWide ? [latex] : body.split(/,\s*\\quad\s*/);
    const separated = clauses.join(",\\\\");
    // A wide data table must not push shorter hypotheses out of the initial scroll view.
    const multiline = scrollIfWide ? `\\begin{array}{l}${separated}\\end{array}`
      : `\\begin{gathered}${separated}\\end{gathered}`;
    const canWrap = clauses.length > 1 || (gathered && scrollIfWide);
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
      const wrapWidth = singleLineWidth * preferredSize * (scrollIfWide ? 1 : 0.85);
      const nextLatex = canWrap && wrapWidth > available ? multiline : latex;

      if (nextLatex !== displayedLatex) {
        displayedLatex = nextLatex;
        field.value = nextLatex;
        schedule();
        return;
      }

      if (scrollIfWide) {
        updateScrollFocus();
      } else {
        const size = Math.floor(Math.min(preferredSize, (available - 1) / widthPerEm) * 10) / 10;
        if (Math.abs(size - currentSize) > 0.05) field.style.fontSize = `${size}px`;
      }
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
      if (scrollIfWide) {
        host.removeAttribute("tabindex");
        host.scrollLeft = 0;
      }
      field.remove();
    };
  }, [className, fitToContainer, label, description, latex, scrollIfWide]);

  return <span ref={hostRef} className={`static-math-host${fitToContainer ? " responsive-math" : ""}${scrollIfWide ? " scrollable-math" : ""}`}
    role={scrollIfWide ? "group" : undefined} aria-label={scrollIfWide ? label : undefined} />;
}

