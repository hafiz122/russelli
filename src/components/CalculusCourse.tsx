import { assessedOutcomes, calculusTopics, chapters, outcomes, topicsForFocus, type CalculusFocus } from "../data/calculus";
import type { LocalProgressV1 } from "../types";
import "./CalculusCourse.css";

export function CalculusIndex({ path }: { path: string }) {
  return <section className="guided-track-intro" aria-labelledby="calculus-title">
    <div>
      <h2 id="calculus-title">Calculus</h2>
      <p>Follow the chapters in order, revisit a topic, or practice a course learning outcome.</p>
      <a className="button quiet" href={path}>Practice calculus</a>
    </div>
    <div>
      <ol aria-label="Calculus chapters">
        {chapters.map(chapter => <li key={chapter.number}>
          <strong><a href={`${path}?chapter=${chapter.number}`}>{chapter.title}</a></strong>
          <span>{chapter.outcomes.join(" · ")}</span>
        </li>)}
      </ol>
      <p>CLO4 · Outcome description unavailable.</p>
    </div>
  </section>;
}

export function CalculusPicker({ focus, disabled, onSelect }: {
  focus: CalculusFocus; disabled: boolean; onSelect: (query: string) => void;
}) {
  const { topic, clo, chapter } = focus;
  const value = topic ? `topic=${topic}${clo ? `&clo=${clo}` : ""}` :
    clo ? `clo=${clo}` : chapter ? `chapter=${chapter}` : "";
  return <label className="topic-select-label">
    Choose calculus practice
    <select value={value} disabled={disabled} onChange={event => onSelect(event.target.value)}>
      <option value="">Follow the five chapters</option>
      <optgroup label="Course learning outcomes">
        {assessedOutcomes.map(id => <option key={id} value={`clo=${id}`}>{id} · {outcomes[id]}</option>)}
        {topic && clo && <option value={value}>{clo} · {calculusTopics[topic].title}</option>}
      </optgroup>
      {chapters.map(item => <optgroup key={item.number} label={`Chapter ${item.number} · ${item.title}`}>
        <option value={`chapter=${item.number}`}>All of Chapter {item.number}</option>
        {topicsForFocus({ chapter: item.number }).map(id => <option key={id} value={`topic=${id}`}>{calculusTopics[id].title}</option>)}
      </optgroup>)}
    </select>
  </label>;
}

export function OutcomeProgress({ progress, path }: { progress: LocalProgressV1; path: string }) {
  return <section className="mastery-list" aria-labelledby="outcome-progress">
    <div className="mastery-heading">
      <h2 id="outcome-progress">Calculus outcomes</h2>
      <p>A topic counts when you answer a question for that outcome correctly on your first try, before opening a hint or solution.</p>
    </div>
    <div className="calculus-outcomes">
      {assessedOutcomes.map(clo => {
        const eligible = topicsForFocus({ clo });
        const solved = progress.independentCalculusTopics[clo];
        const outstanding = eligible.filter(id => !solved.includes(id));
        return <article key={clo}>
          <h3><a href={`${path}?clo=${clo}`}>{clo} · {outcomes[clo]}</a></h3>
          <p>{solved.length} of {eligible.length} topics solved independently</p>
          {clo === "CLO2" && <p>Chapter 5 draws on series approximations, equations of planes, and partial derivatives when you evaluate an integral.</p>}
          {outstanding.length > 0 && <details>
            <summary>Topics to practice ({outstanding.length})</summary>
            <ul>{outstanding.map(id => <li key={id}>
              <a href={`${path}?topic=${id}&clo=${clo}`}>{calculusTopics[id].title}</a>
            </li>)}</ul>
          </details>}
        </article>;
      })}
      <p><strong>CLO4</strong> · Outcome description unavailable.</p>
    </div>
  </section>;
}
