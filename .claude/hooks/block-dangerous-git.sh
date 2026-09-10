#!/bin/bash

# NOT CURRENTLY WIRED UP. No `hooks` block references this script, and the
# guardrail it was written for lives in Claude Code's `permissions.deny` list
# instead — a deny rule refuses the call before a shell is spawned, which the
# PreToolUse route cannot promise on a machine where the hook fails to run.
# Kept because it is the script `git-guardrails-claude-code` installs and the
# thing to reach for if the deny list ever stops being enough. Recorded in
# issue 110, which is what made this file version-controlled at all.

# Read the full PreToolUse payload from stdin.
# We intentionally do NOT depend on `jq` here: on some machines (notably
# Windows git-bash) jq isn't on PATH, and a missing parser would make the
# hook fail open (exit 0) and silently allow every command. Scanning the
# raw payload is dependency-free and fails toward blocking.
INPUT=$(cat)

# Best-effort extraction of the command for the message only.
COMMAND=$(echo "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p')
[ -z "$COMMAND" ] && COMMAND="$INPUT"

DANGEROUS_PATTERNS=(
  "git push"
  "git reset --hard"
  "git clean -fd"
  "git clean -f"
  "git branch -D"
  "git checkout \."
  "git restore \."
  "push --force"
  "reset --hard"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$INPUT" | grep -qE "$pattern"; then
    echo "BLOCKED: '$COMMAND' matches dangerous pattern '$pattern'. The user has prevented you from doing this." >&2
    exit 2
  fi
done

exit 0
