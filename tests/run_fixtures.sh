#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURES_DIR="$ROOT_DIR/tests/fixtures"
OUT_DIR="$ROOT_DIR/tests/output"
FAIL_DIR="$OUT_DIR/failures"
LOG_DIR="$OUT_DIR/logs"
TEXMF_DIR="$OUT_DIR/texmf"
mkdir -p "$FAIL_DIR" "$LOG_DIR"
mkdir -p "$TEXMF_DIR/home" "$TEXMF_DIR/config" "$TEXMF_DIR/var"

export TEXMFHOME="$TEXMF_DIR/home"
export TEXMFCONFIG="$TEXMF_DIR/config"
export TEXMFVAR="$TEXMF_DIR/var"
export TEXINPUTS="$ROOT_DIR/tests/fixtures:${TEXINPUTS:-}"

source "$ROOT_DIR/tests/lib/latex_integrity.sh"

LATEXMK="${LATEXMK:-$(command -v latexmk)}"

status=0
while IFS= read -r tex; do
  base="$(basename "$tex" .tex)"
  workdir="$OUT_DIR/work/$base"
  rm -rf "$workdir"
  mkdir -p "$workdir"
  cp "$tex" "$workdir/$base.tex"
  if ! check_balance "$workdir/$base.tex"; then
    printf 'FAIL %s integrity\n' "$base"
    status=1
    continue
  fi
  if "$LATEXMK" -g -pdf -interaction=nonstopmode -halt-on-error -file-line-error -outdir="$workdir" "$workdir/$base.tex" >"$LOG_DIR/$base.log" 2>&1; then
    printf 'PASS %s\n' "$base"
  else
    printf 'FAIL %s compile\n' "$base"
    cp "$workdir/$base.tex" "$FAIL_DIR/$base.tex"
    cp "$LOG_DIR/$base.log" "$FAIL_DIR/$base.log"
    status=1
  fi
done < <(find "$FIXTURES_DIR" -type f -name '*.tex' | sort)
exit "$status"
