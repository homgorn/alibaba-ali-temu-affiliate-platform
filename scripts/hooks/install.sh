#!/bin/sh
# Install the tracked git hooks into .git/hooks, which git does not version.
#
# Idempotent: safe to run again on every fresh clone or after `git checkout`.
# Never deletes anything (R1). Exits 0 when the hook is in place, so it can be
# chained into a setup script.
set -e

ROOT=$(git rev-parse --show-toplevel)
SRC="$ROOT/scripts/hooks"
DST="$ROOT/.git/hooks"

if [ ! -d "$DST" ]; then
  echo "install-hooks: no .git/hooks directory (not a git repo?)" >&2
  exit 1
fi

# Prefer core.hooksPath: it survives `git checkout` of the hook itself and is
# the mechanism git actually documents. Fall back to copying where the
# filesystem or git version will not take it.
if git config core.hooksPath scripts/hooks 2>/dev/null; then
  echo "install-hooks: core.hooksPath = scripts/hooks"
  exit 0
fi

echo "install-hooks: core.hooksPath unavailable, copying instead"
for f in "$SRC"/pre-*; do
  [ -e "$f" ] || continue
  name=$(basename "$f")
  cp "$f" "$DST/$name"
  chmod +x "$DST/$name"
  echo "install-hooks: installed $DST/$name"
done
exit 0