import { useId, useRef } from "react";
import type { MathfieldElement } from "mathlive";
import type { DistributionFamily } from "../types";
import { distributionFamilies, distributionLatex, distributions, readDistribution } from "../math/distributions";
import { MathAnswerInput } from "./MathField";
import "./DistributionAnswer.css";

interface DistributionAnswerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled: boolean;
  readOnly: boolean;
}

export function DistributionAnswerInput({ value, onChange, onSubmit, disabled, readOnly }: DistributionAnswerProps) {
  const id = useId();
  const group = useRef<HTMLFieldSetElement>(null);
  const answer = readDistribution(value);

  function chooseFamily(family: DistributionFamily | "") {
    onChange(family ? distributionLatex(family, distributions[family].parameters.map(() => "")) : "");
  }

  function completeAnswer(index: number, parameter: string): string {
    if (!answer) return "";
    const fields = group.current?.querySelectorAll<MathfieldElement>("math-field");
    const parameters = answer.parameters.map((previous, i) => i === index ? parameter : fields?.[i]?.value ?? previous);
    return distributionLatex(answer.family, parameters);
  }

  return (
    <fieldset className="distribution-answer" ref={group} disabled={disabled}>
      <legend className="answer-label">Final answer</legend>
      <div className="distribution-control">
        <label htmlFor={id}>Distribution family</label>
        <select id={id} disabled={disabled || readOnly} value={answer?.family ?? ""}
          onChange={(event) => chooseFamily(event.target.value as DistributionFamily | "")}>
          <option value="">Choose a distribution</option>
          {distributionFamilies.map((family) => <option key={family} value={family}>{distributions[family].name}</option>)}
        </select>
      </div>
      {answer && <div className="distribution-parameters">
        {distributions[answer.family].parameters.map((label, index) => {
          const fieldId = `${id}-${index}`;
          return (
            <div className="distribution-control" key={label}>
              <label htmlFor={fieldId}>{label}</label>
              <MathAnswerInput id={fieldId} label={label} placeholder="" value={answer.parameters[index]}
                onChange={(parameter) => onChange(completeAnswer(index, parameter))}
                onSubmit={(parameter) => onSubmit(completeAnswer(index, parameter))}
                disabled={disabled} readOnly={readOnly} />
            </div>
          );
        })}
      </div>}
    </fieldset>
  );
}
