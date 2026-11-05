# russelli.

Paper-first algebra practice for college beginners. The site presents one problem at a time: work through it in a notebook, enter the final mathematical answer, and check it in the browser.

Live site: [hafiz122.github.io/russelli](https://hafiz122.github.io/russelli/)

## Using the site

1. Open **Practice** to start or resume the eight-topic calibration.
2. Solve the displayed problem on paper. Use the math field and its virtual keyboard to enter your final answer.
3. Select **Check answer** or press Enter. Incomplete input keeps the check button disabled; an incorrect answer can be edited and checked again.
4. Reveal hints one at a time or open the worked solution when you need help. You can also skip a question.
5. Continue with the adaptive queue, or select a topic under **Practice focus** for focused practice.
6. Open **Progress** to review topic readiness and recent answer checks. **Reset local progress** opens a confirmation dialog before clearing the record.

The adaptive queue considers mastery, how recently a topic appeared, and prerequisite readiness. Difficulty moves between easy, medium, and hard as mastery changes. First-attempt success increases mastery more than success after retries or hints; incorrect checks and skips reduce it.

### Topics and answer formats

| Topic | Current practice |
| --- | --- |
| Expressions | Distribute factors and collect like terms |
| Equations & inequalities | Solve linear equations and express inequality solutions as intervals |
| Lines & systems | Find a line through two points and solve two-variable linear systems |
| Exponents & radicals | Multiply powers with the same base and simplify square roots |
| Polynomials | Expand and simplify products of binomials |
| Factoring & quadratics | Factor quadratics and find their real roots |
| Rational expressions | Cancel common factors and solve rational equations |
| Functions | Evaluate compositions and inverse functions |

Follow each problem's answer instructions:

- Enter numbers, fractions, expressions, or equations as requested. The validator compares mathematical equivalence rather than literal text.
- Enter system solutions as `(x, y)` and quadratic roots as `(smaller, larger)`.
- Use interval notation for inequalities, such as `[2, ∞)`. Infinity always takes a parenthesis. The validator also supports equivalent one-sided inequality notation.
- Keep a factorization in factored form when the question requests it, and cancel common factors when simplifying a rational expression. Equivalence alone does not satisfy these form requirements.

### Local progress

The application runs entirely in the browser, with no account or backend service. It saves calibration state, mastery scores, topic preference, recent attempts, and recent seeds in `localStorage` under `russelli.progress.v1`.

The record retains up to 80 attempts and 40 recent seeds; the progress page displays the latest six checks. Progress belongs to the browser profile and site origin, so local development and the live site have separate records. It does not sync across browsers or devices. Clearing site data or confirming a reset removes the record. If saved progress cannot be read, the app starts a fresh record and displays a recovery notice.

On the same browser profile and site origin, the app also reads the legacy `nurkh.progress.v1` key when no current record exists, preserving progress saved before the rename. Subsequent saves use `russelli.progress.v1`; a reset clears both keys.

## Local development

Use Node.js **22.13.0 or newer** and npm. Run these commands from the repository root:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No API keys or environment file are required for local development.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run Playwright browser tests |
| `npm run build` | Type-check TypeScript and build the static site into `dist/` |
| `npm run preview` | Serve the existing production build locally |

To inspect the production build:

```sh
npm run build
npm run preview
```

### Routes

| Path | Page |
| --- | --- |
| `/` | Introduction and topic index |
| `/practice/` | Calibration, adaptive practice, and answer checking |
| `/progress/` | Local readiness scores, recent checks, and reset controls |

Topic links use the skill ID as a query parameter, for example `/practice/?topic=functions`. The IDs are defined in [src/data/skills.ts](src/data/skills.ts).

## Verification

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

The unit suite covers answer equivalence, answer-form constraints, calibration, mastery updates, and local-storage compatibility and recovery. Generator tests check reproducibility and acceptance of the generated answer for 1,000 seeds per topic and difficulty: 24,000 combinations across eight topics and three difficulty levels. Additional regressions check rational-equation domain restrictions and worked solutions with negative function inputs.

Playwright runs desktop Chrome and Pixel 7 browser profiles. Its tests cover retries, hints, worked solutions, progress navigation, topic selection, MathLive input, interval handling, and accepted-answer feedback. It also checks serious or critical accessibility violations on the home page, practice-page reflow at several widths, control sizes, and reduced motion. The test configuration starts its own Vite server at `http://127.0.0.1:4173`; you do not need to start one separately.

## Deployment

The site builds to static files and currently deploys to GitHub Pages through [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml). A push to `main` or a manual workflow run installs dependencies with `npm ci`, runs the unit tests, builds the site, and uploads `dist/` to Pages. The deployment workflow does not run Playwright.

In the repository's GitHub Pages settings, select **GitHub Actions** as the build and deployment source.

The workflow sets `VITE_BASE_PATH=/russelli/` for the repository URL. To reproduce that build locally:

```sh
VITE_BASE_PATH=/russelli/ npm run build
VITE_BASE_PATH=/russelli/ npm run preview
```

Open the preview URL with `/russelli/` appended. `VITE_BASE_PATH` defaults to `/`; set it to the deployment subdirectory, including leading and trailing slashes, when hosting under another path. Build again after changing it.

Vite emits separate HTML entry points for the home, practice, and progress pages. Other static hosts should publish the full `dist/` directory and serve `practice/index.html` and `progress/index.html` at their directory URLs.

## Code structure

The stack is React and TypeScript with Vite, MathLive for mathematical input and rendering, and Cortex Compute Engine for answer validation. Fonts ship with the app through Fontsource: Source Serif 4 for the academic reading style and IBM Plex Sans for controls.

| Location | Responsibility |
| --- | --- |
| `src/App.tsx` | Page selection, site shell, practice flow, and progress view |
| `src/components/MathField.tsx` | MathLive answer input and read-only math rendering |
| `src/data/skills.ts` | Topic definitions, IDs, and prerequisites |
| `src/types.ts` | Question, answer, attempt, generator, and progress contracts |
| `src/math/generators.ts` | Seeded question generators, hints, and worked solutions |
| `src/math/rng.ts`, `src/math/format.ts` | Deterministic random values and math formatting |
| `src/math/validator.ts` | Parsing, equivalence checks, and required answer forms |
| `src/state/adaptive.ts` | Topic selection, difficulty, mastery, and attempt recording |
| `src/state/storage.ts` | Versioned browser storage, recovery, and reset |
| `src/styles.css` | Paper-and-ink theme and responsive layout |
| `tests/` | Generator, validator, progress, and browser tests |
| `vite.config.ts` | Base path, HTML entry points, and Vitest configuration |

## Making changes

Read [AGENTS.md](AGENTS.md) and [DESIGN.md](DESIGN.md) before changing the interface. Preserve the paper-first sequence: one problem, working on paper, then final-answer input. Keep the warm paper surface, restrained lilac-pink notes, visible keyboard focus, and functional controls. Verify mobile reflow and color contrast for UI changes.

When adding a topic:

1. Add its skill ID and definition, including prerequisites, in `src/types.ts` and `src/data/skills.ts`.
2. Register a deterministic generator in `src/math/generators.ts`. The same seed and difficulty must reproduce the same question. Include the prompt, answer specification, hints, worked solution, and mathematical constraints.
3. Extend the validator if the topic requires another answer kind or form constraint.
4. Add targeted validation cases and check generation across a large seed range. The existing generator suite iterates over every registered skill and difficulty.
5. Review calibration, mastery, and saved-progress compatibility. Update the storage schema and recovery behavior if the persisted format changes.
