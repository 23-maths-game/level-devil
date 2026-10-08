#!/usr/bin/env bash
# ============================================================
#  push-to-github.sh — push TRAP DEVIL to the existing repo
#  Target: https://github.com/23-maths-game/level-devil
#
#  The local repo already contains the merged history
#  (original UI shell commits + the complete game).
#  You need WRITE ACCESS to the repo — git will ask for
#  your GitHub username + password/token on first push.
# ============================================================
set -e
cd "$(dirname "$0")"

REPO_URL="https://github.com/23-maths-game/level-devil.git"

echo "😈 Pushing TRAP DEVIL: RAGE EDITION → github.com/23-maths-game/level-devil"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

git branch -M main
git push -u origin main

echo ""
echo "✅ Pushed! Now make it playable live:"
echo "   Repo → Settings → Pages → Source: Deploy from a branch"
echo "   → Branch: main / (root) → Save"
echo "   Live at: https://23-maths-game.github.io/level-devil/"
