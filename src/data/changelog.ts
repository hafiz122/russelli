import mergedPullRequests from "./merged-pull-requests.json";

export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  summary: string;
  changes: string[];
}

const releaseNotes: ChangelogEntry[] = [
  {
    id: "calculus-practice",
    date: "2026-11-21",
    title: "Calculus practice by chapter and outcome",
    summary: "Work through 34 topics from parametric curves to multiple integrals.",
    changes: [
      "Choose a chapter, a topic, or one of the three defined course learning outcomes.",
      "Progress shows which topics you have solved independently for each outcome and links to the topics still to practice."
    ]
  },
  {
    id: "hypothesis-test-notation",
    date: "2026-11-21",
    title: "Corrected hypothesis-test subscripts",
    summary: "Observed z and t statistics now display “obs” as a single subscript.",
    changes: [
      "Corrected the p-value and actual-size subscripts in worked solutions.",
      "Screen readers announce the observed statistic and its value in the question."
    ]
  },
  {
    id: "hypothesis-testing",
    date: "2026-11-21",
    title: "Hypothesis testing practice",
    summary: "Test claims about means, proportions, and variances using sample data and probability tables.",
    changes: [
      "Enter a p-value and choose whether to reject the null hypothesis. Each worked solution explains the conclusion in context.",
      "Practice Type I and Type II errors, power, most-powerful tests, and likelihood ratios."
    ]
  },
  {
    id: "statistics-probability",
    date: "2026-11-21",
    title: "Statistics & probability practice",
    summary: "Follow eight topics from permutations and combinations to sampling distributions, or go straight to a topic you want to practice.",
    changes: [
      "Work out probabilities, derive densities, and identify the sampling law of a statistic.",
      "For a distribution answer, choose the family and enter its parameters together."
    ]
  },
  {
    id: "linear-algebra",
    date: "2026-11-10",
    title: "Linear algebra practice",
    summary: "A separate guided track now covers computational linear algebra from vectors through eigenvectors.",
    changes: [
      "Practice five connected topics with paper-first questions, hints, and worked solutions.",
      "Enter exact matrix answers with a matrix template, and check eigenvectors up to nonzero scaling.",
      "Existing algebra calibration and saved progress remain available."
    ]
  },
  {
    id: "changelog",
    date: "2026-11-05",
    title: "A place for updates",
    summary: "You can now read about changes to russelli. in the Changelog tab.",
    changes: [
      "Open Changelog from any page to find dated notes about features and fixes."
    ]
  },
  {
    id: "interval-answers",
    date: "2026-10-25",
    title: "Better interval answer checking",
    summary: "More ways of entering a correct interval now work in the answer field.",
    changes: [
      "Equivalent decimal and fraction endpoints are accepted for interval answers.",
      "Brackets typed into the math field are recognized when checking intervals.",
      "Answers committed through the math keyboard stay in sync with the check button."
    ]
  }
];

export const changelog: ChangelogEntry[] = [...mergedPullRequests, ...releaseNotes]
  .sort((a, b) => b.date.localeCompare(a.date));
