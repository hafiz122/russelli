import { curvesSeriesTopics } from "../math/calculusCurvesSeries";
import { geometryPartialsTopics } from "../math/calculusGeometryPartials";
import { integralTopics } from "../math/calculusIntegrals";
import type { Chapter, Outcome } from "../math/calculusTopic";

export const calculusTopics = { ...curvesSeriesTopics, ...geometryPartialsTopics, ...integralTopics };
export type CalculusSkillId = keyof typeof calculusTopics;
export const calculusIds = Object.keys(calculusTopics) as CalculusSkillId[];

export const chapters = [
  { number: 1, title: "Parametric Equations and Polar Coordinates", outcomes: ["CLO1", "CLO3"] },
  { number: 2, title: "Infinite Sequences and Series", outcomes: ["CLO1", "CLO2", "CLO3", "CLO4"] },
  { number: 3, title: "Vectors and the Geometry of Space", outcomes: ["CLO1", "CLO2", "CLO3", "CLO4"] },
  { number: 4, title: "Partial Derivatives", outcomes: ["CLO1", "CLO2", "CLO3"] },
  { number: 5, title: "Multiple Integrals", outcomes: ["CLO1", "CLO2", "CLO3", "CLO4"] }
] as const;

export const outcomes: Record<Outcome, string> = {
  CLO1: "Understand calculus concepts",
  CLO2: "Compute double and triple integrals",
  CLO3: "Solve problems and report accurately"
};
export const assessedOutcomes = Object.keys(outcomes) as Outcome[];

export function isCalculusTopic(id: unknown): id is CalculusSkillId {
  return typeof id === "string" && Object.hasOwn(calculusTopics, id);
}

export interface CalculusFocus {
  topic?: CalculusSkillId;
  chapter?: Chapter;
  clo?: Outcome;
}

export function readCalculusFocus(search: string): CalculusFocus {
  const query = new URLSearchParams(search);
  const topicId = query.get("topic");
  const chapter = chapters.find(item => String(item.number) === query.get("chapter"));
  const clo = assessedOutcomes.find(item => item === query.get("clo")?.toUpperCase());
  if (clo) return isCalculusTopic(topicId) && calculusTopics[topicId].outcomes.includes(clo) ? { topic: topicId, clo } : { clo };
  if (isCalculusTopic(topicId)) return { topic: topicId };
  return chapter ? { chapter: chapter.number } : {};
}

export function topicsForFocus({ chapter, clo, topic }: CalculusFocus): CalculusSkillId[] {
  return calculusIds.filter(id => (!topic || id === topic) &&
    (!chapter || calculusTopics[id].chapter === chapter) && (!clo || calculusTopics[id].outcomes.includes(clo)));
}
