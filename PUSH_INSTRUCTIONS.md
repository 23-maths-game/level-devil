# 🚀 How to push this game to GitHub

The game is **complete and tested locally** (120/120 levels validated, 16/16 smoke
tests pass). Pushing to GitHub needs **your** GitHub credentials — an agent sandbox
cannot log in to GitHub on its own. The local repo already has the merged history
and the `origin` remote set to `https://github.com/23-maths-game/level-devil.git`.

Pick **ONE** path:

---

## Path A — Give the agent a token (fastest) 🤖

1. Go to github.com → your avatar → **Settings → Developer settings → Personal
   access tokens → Fine-grained tokens → Generate new token**.
2. Token name: `trap-devil-push`. Expiration: **1 day**.
3. Repository access: **Only select repositories** → `23-maths-game/level-devil`.
4. Permissions → Repository permissions → **Contents: Read and write**.
5. Generate, copy the token, paste it to the agent. It pushes immediately.
6. Afterwards, revoke the token (same page). Treat it like a password.

## Path B — Push it yourself (no token sharing) 💻

1. Download **`trap-devil-rage-edition.zip`** from this workspace. It contains the
   full folder **including the `.git` history** and the `origin` remote already set.
2. Unzip it anywhere. Open a terminal **inside the unzipped folder**.
3. Run:
   ```bash
   git push -u origin main
   ```
4. Git asks for your GitHub username + password (or a token as the password). Done.

> If the unzipped folder is missing `.git`, do this instead:
> ```bash
> git clone https://github.com/23-maths-game/level-devil.git
> cd level-devil
> # copy ALL files from the downloaded folder over the clone:
> # replace index.html and README.md, add js/ css/ tools/ assets/
> # package.json LICENSE .gitignore push-to-github.sh, and DELETE the old root style.css
> git add -A
> git commit -m "feat: complete Trap Devil — 120 levels, 2D engine, tests"
> git push
> ```

## Path C — GitHub website only (no terminal) 🌐

Uses the **single-file build** — the entire game in one HTML file.

1. Download **`trap-devil-single-file.html`** from this workspace.
2. Rename it to **`index.html`** on your computer.
3. On the repo page (github.com/23-maths-game/level-devil):
   - Open `index.html` → 🗑️ (delete) → commit the deletion.
   - Open `style.css` → 🗑️ (delete) → commit the deletion.
   - **Add file → Upload files** → upload your renamed `index.html` → commit.
4. Enable **Settings → Pages → Deploy from a branch → main / (root) → Save**.
5. Live at: **https://23-maths-game.github.io/level-devil/**

> Note: Path C replaces the project with the single-file version (simpler, but the
> full multi-file project with tests lives in Paths A/B).

---

## After pushing — go live with GitHub Pages 🎮

Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`,
folder: `/ (root)` → **Save**. Your game goes live at:

**https://23-maths-game.github.io/level-devil/**
