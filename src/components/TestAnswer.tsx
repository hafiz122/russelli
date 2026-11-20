import { useId, useRef } from "react";
import type { MathfieldElement } from "mathlive";
import { readTestAnswer, testAnswerLatex, type TestDecision } from "../math/testAnswers";
import { MathAnswerInput } from "./MathField";
import "./TestAnswer.css";

interface TestAnswerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled: boolean;
  readOnly: boolean;
}

export function TestAnswerInput({ value, onChange, onSubmit, disabled, readOnly }: TestAnswerProps) {
  const id = useId();
  const group = useRef<HTMLFieldSetElement>(null);
  const answer = readTestAnswer(value);
  const pValue = answer?.pValue ?? "";

  function withDecision(latex: string): string {
    const checked = group.current?.querySelector<HTMLInputElement>("input:checked");
    return testAnswerLatex(latex, checked ? checked.value as TestDecision : null);
  }

  function choose(decision: TestDecision) {
    const field = group.current?.querySelector<MathfieldElement>("math-field");
    onChange(testAnswerLatex(field?.value ?? pValue, decision));
  }

  return (
    <fieldset ref={group} className="test-answer" disabled={disabled} aria-describedby={`${id}-precision`}>
      <legend className="answer-label">Final answer</legend>
      <label className="test-parameter-label" htmlFor={id}>p-value</label>
      <p className="test-precision" id={`${id}-precision`}>Enter a value from 0 to 1, rounded to four decimal places.</p>
      <MathAnswerInput id={id} label="p-value" placeholder="" value={pValue}
        onChange={(latex) => onChange(withDecision(latex))} onSubmit={(latex) => onSubmit(withDecision(latex))}
        disabled={disabled} readOnly={readOnly} />
      <fieldset className="test-decision" disabled={disabled || readOnly}>
        <legend>Decision</legend>
        {(["reject", "fail_to_reject"] as const).map((decision) => (
          <label key={decision}>
            <input type="radio" name={`${id}-decision`} value={decision}
              checked={answer?.decision === decision} onChange={() => choose(decision)} />
            <span>{decision === "reject" ? "Reject H₀" : "Fail to reject H₀"}</span>
          </label>
        ))}
      </fieldset>
    </fieldset>
  );
}
