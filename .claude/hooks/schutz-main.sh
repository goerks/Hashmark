#!/usr/bin/env bash
# PreToolUse-Hook (Bash/PowerShell): schützt `main`. Blockiert Commit/Merge/Rebase auf main, Push von oder nach main
# und jeden Force-Push. Exit 2 = Aufruf wird abgelehnt, die Meldung auf stderr sieht Claude.
input=$(cat)
cmd=$(printf '%s' "$input" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(\([^"\\]\|\\.\)*\)".*/\1/p' | head -1)
[ -z "$cmd" ] && exit 0

branch=$(git -C "${CLAUDE_PROJECT_DIR:-.}" symbolic-ref --short HEAD 2>/dev/null)
block() { echo "Blockiert: $1 Feature-Branch anlegen (/feature <thema>) und per Pull Request arbeiten (siehe .claude/rules/git-workflow.md)." >&2; exit 2; }

if printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+(-C[[:space:]]+[^ ]+[[:space:]]+)?(commit|merge|rebase|cherry-pick|revert)\b'; then
  case "$branch" in main|master) block "Direkte Änderungen auf '$branch' sind nicht erlaubt.";; esac
fi

if printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+(-C[[:space:]]+[^ ]+[[:space:]]+)?push\b'; then
  printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])(--force|--force-with-lease|-f)([[:space:]=]|$)' && block "Force-Push ist nicht erlaubt."
  printf '%s' "$cmd" | grep -Eq '(^|[[:space:]:])(main|master)([[:space:]]|$)' && block "Push nach main ist nicht erlaubt."
  case "$branch" in main|master) block "Push von '$branch' ist nicht erlaubt.";; esac
fi
exit 0
