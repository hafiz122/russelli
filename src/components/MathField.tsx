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
}

export function MathAnswerInput({ value, onChange, onSubmit, disabled = false, readOnly = false, label }: MathAnswerInputProps) {
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

  return <div ref={hostRef} className="math-answer-host" />;
}

interface StaticMathProps {
  latex: string;
  label?: string;
  className?: string;
}

export function StaticMath({ latex, label, className = "" }: StaticMathProps) {
  const hostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const field = new MathfieldElement();
    field.readOnly = true;
    field.value = latex;
    field.className = `static-math ${className}`.trim();
    field.setAttribute("aria-label", label ?? latex);
    host.append(field);
    return () => field.remove();
  }, [className, label, latex]);

  return <span ref={hostRef} className="static-math-host" />;
}

