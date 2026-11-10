export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  summary: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
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
