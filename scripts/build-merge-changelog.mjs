import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const commits = new Set(execFileSync("git", ["rev-list", "HEAD"], { encoding: "utf8" }).trim().split("\n"));
const pulls = execFileSync("gh", [
  "api", "--paginate", "repos/{owner}/{repo}/pulls?state=closed&base=main&per_page=100",
  "--jq", ".[] | select(.merged_at != null) | {number, title, merged_at, merge_commit_sha} | @json"
], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

const entries = pulls.split("\n").filter(Boolean)
  .map(line => JSON.parse(line))
  .filter(pr => commits.has(pr.merge_commit_sha))
  .sort((a, b) => b.merged_at.localeCompare(a.merged_at) || b.number - a.number)
  .map(pr => ({
    id: `pr-${pr.number}`,
    date: pr.merged_at.slice(0, 10),
    title: pr.title,
    summary: `Merged in pull request #${pr.number}.`,
    changes: []
  }));

writeFileSync(new URL("../src/data/merged-pull-requests.json", import.meta.url), JSON.stringify(entries, null, 2) + "\n");
