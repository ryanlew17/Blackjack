#!/usr/bin/env bash
# Launch Blackjack - The Green Room (starts the local game server and opens
# your browser automatically).
# macOS: double-click this file (if blocked the first time, right-click -> Open);
#        you can also run it in a terminal: bash start-game.command
# Linux: right-click -> "Run in terminal" (or chmod +x once, then execute directly)
# Note: keep this file name pure ASCII -- when launching a .command via double-click,
# Finder->Terminal mangles non-ASCII file names and Terminal then fails with
# "No such file or directory".

cd "$(dirname "$0")" || exit 1

# Probe node; the game requires Node.js 22.12+
NODE_OK=""
if command -v node >/dev/null 2>&1 \
   && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)' >/dev/null 2>&1; then
    NODE_OK=1
fi

if [ -z "$NODE_OK" ]; then
    echo
    echo "[Error] No usable Node.js 22.12+ environment was detected."
    echo "Please install the LTS version from the official site first: https://nodejs.org/"
    echo
    echo "Opening the download page ..."
    if command -v open >/dev/null 2>&1; then
        open "https://nodejs.org/"        # macOS
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "https://nodejs.org/"    # Linux
    fi
    printf "Press Enter to exit ..."
    read -r _
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "First run: installing dependencies (npm ci) ..."
    if ! npm ci; then
        echo
        echo "[Error] Dependency installation failed. Check your network and retry."
        printf "Press Enter to exit ..."
        read -r _
        exit 1
    fi
fi

npm run dev -- --open

echo
echo "Game server stopped."
printf "Press Enter to close this window ..."
read -r _
exit 0
