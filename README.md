# ISU Game Hub

A game hub for Iowa State fans, built by Scott Gray (sgray08@iastate.edu). Five games, each with more than one way to play, plus XP, levels and leaderboards.

**ISU Jeopardy board:** the Jeopardy game started as the COM S 3190 team project for team MS_16, by Scott Gray (sgray08@iastate.edu) and Kai Gasparovich (gus22781@iastate.edu). The rest of the hub grew out of it.

## What is in the hub

| Game | Ways to play |
| --- | --- |
| **ISU Jeopardy** | Host mode (someone reads the clue and awards points) or Multiple Choice (two teams take turns, timed answers, right answers score, wrong ones cost you). Every board hides a Daily Double. |
| **Quiz Blitz** | 60-second Blitz (streak multipliers, wrong answers cost time) or Sudden Death (one wrong answer ends the run). |
| **Family Feud** | Quick Match (3 rounds) or Full Match (6 rounds). Typed answers with fuzzy matching, three strikes, and a steal for the other team. |
| **Maze** | Maze Run (steer Cy through three mazes) or Maze Solver (watch BFS, DFS and A* search a maze). |
| **Memory Match** | Easy 4x4 or Hard 6x4 against a 90 second clock. Back-to-back matches build a combo. |

Every finished game earns XP (level n needs 100 x n XP) and a leaderboard entry. One game each day is the featured game and pays double XP. Scores, XP and the sound setting are saved in the browser with `localStorage`.

## Run it

The pages load their data with `fetch`, so open the project through a local web server instead of double clicking the HTML files:

```
python3 -m http.server 8000
```

Then visit http://localhost:8000. There is no build step and nothing to install.

## Project layout

```
index.html, index.js        landing page
content/                    games hub, mode chooser, leaderboard and the five games
  ISU_Board.*               Jeopardy
  blitz.*                   Quiz Blitz
  feud.*                    Family Feud
  maze.*, maze-lib.js       Maze (maze-lib.js has the generator and solvers, no DOM)
  memory.*                  Memory Match
assets/
  hub.js                    shared engine: animation, particles, sound, XP, leaderboards
  hub.css                   shared design tokens and components
  *.css                     one stylesheet per page or game
  images/                   pictures used by Jeopardy and Memory Match
data/                       all game content as JSON (questions, surveys, games, modes, FAQ)
scripts/validate.mjs        project checks, also run by CI
.github/workflows/          GitHub Actions: validate, then deploy to GitHub Pages
```

### Animations

`assets/hub.js` is a small animation engine written for this project with no libraries: Web Animations API helpers, spring and bounce easing, a canvas particle system for confetti and fireworks, a 3D card tilt, page transitions and synthesized sound effects. It respects the browser's reduced motion setting.

### Changing the content

- Jeopardy clues: `data/questions.json`. Each question needs a `correct` answer and exactly three `wrong` answers for the multiple choice mode.
- Quiz Blitz questions: `data/quiz.json` (the Jeopardy questions are mixed in automatically).
- Family Feud surveys: `data/feud.json`. Answer points should add up to 100. `aliases` are extra phrases that count as a match. The surveys are made up for fun.
- Memory cards: `data/memory.json`.

## Checks and deployment

```
node scripts/validate.mjs
```

This parses every JSON file, checks JavaScript syntax, confirms linked files exist, checks the game data shape, and tests the maze generator and solvers. The same check runs in GitHub Actions on every push and pull request. When it passes on `main`, the workflow publishes the site to GitHub Pages.

One-time setup: in the repository go to Settings, Pages, and set **Source** to **GitHub Actions**.

## Known limitations

- Scores live in each player's own browser. There is no shared online leaderboard yet; the seeded names on the leaderboard are examples.
- The Family Feud surveys are invented, not real polling.
- Sound effects are generated in the browser and start after the first click, because browsers block audio before that.
