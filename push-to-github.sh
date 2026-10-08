#!/usr/bin/env bash
# ============================================================
#  push-to-github.sh — put TRAP DEVIL on GitHub, the proper way
#  Usage:
#    1. Create a new EMPTY repo on github.com named: trap-devil-rage-edition
#    2. Run:  ./push-to-github.sh
#  (or skip step 1 and let the script create it, if you have the
#   GitHub CLI "gh" installed and authenticated)
# ============================================================
set -e
cd "$(dirname "$0")"

REPO_NAME="trap-devil-rage-edition"
REMOTE_URL="https://github.com/$(gh api user -q .login 2>/dev/null || echo YOUR_GITHUB_USERNAME)/${REPO_NAME}.git"

echo "😈 Pushing TRAP DEVIL: RAGE EDITION to GitHub…"

# If gh CLI is available, create the repo automatically (skip if it exists)
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  if ! gh repo view "${REPO_NAME}" >/dev/null 2>&1; then
    echo "📦 Creating GitHub repo: ${REPO_NAME}"
    gh repo create "${REPO_NAME}" --public --description "😈 A rage-inducing but FAIR 2D troll platformer. 120 levels, 1-2 players, 15 troll mechanics. You don't lose because you're bad — you lose because the level hates you." --homepage "" 2>/dev/null || true
  fi
  REMOTE_URL="https://github.com/$(gh api user -q .login)/${REPO_NAME}.git"
fi

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "${REMOTE_URL}"
else
  git remote add origin "${REMOTE_URL}"
fi

git branch -M main
git push -u origin main

echo ""
echo "✅ Done! Now enable GitHub Pages to play it live:"
echo "   Repo → Settings → Pages → Source: Deploy from a branch → Branch: main / root → Save"
echo "   Your game will be live at: https://YOUR_GITHUB_USERNAME.github.io/${REPO_NAME}/"
