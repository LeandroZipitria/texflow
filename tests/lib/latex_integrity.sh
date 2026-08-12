#!/usr/bin/env bash
set -euo pipefail

check_balance() {
  local file="$1"
  local text
  text="$(cat "$file")"

  local begin_doc end_doc begin_frame end_frame begin_itemize end_itemize begin_enum end_enum begin_eq end_eq begin_align end_align opens closes

  begin_doc=$(grep -o '\\begin{document}' "$file" | wc -l | tr -d ' ')
  end_doc=$(grep -o '\\end{document}' "$file" | wc -l | tr -d ' ')
  begin_frame=$(grep -o '\\begin{frame}' "$file" | wc -l | tr -d ' ')
  end_frame=$(grep -o '\\end{frame}' "$file" | wc -l | tr -d ' ')
  begin_itemize=$(grep -o '\\begin{itemize}' "$file" | wc -l | tr -d ' ')
  end_itemize=$(grep -o '\\end{itemize}' "$file" | wc -l | tr -d ' ')
  begin_enum=$(grep -o '\\begin{enumerate}' "$file" | wc -l | tr -d ' ')
  end_enum=$(grep -o '\\end{enumerate}' "$file" | wc -l | tr -d ' ')
  begin_eq=$(grep -o '\\begin{equation}' "$file" | wc -l | tr -d ' ')
  end_eq=$(grep -o '\\end{equation}' "$file" | wc -l | tr -d ' ')
  begin_align=$(grep -o '\\begin{align}' "$file" | wc -l | tr -d ' ')
  end_align=$(grep -o '\\end{align}' "$file" | wc -l | tr -d ' ')

  opens=$(grep -o '{' "$file" | wc -l | tr -d ' ')
  closes=$(grep -o '}' "$file" | wc -l | tr -d ' ')

  [[ "$begin_doc" == "$end_doc" ]]
  [[ "$begin_frame" == "$end_frame" ]]
  [[ "$begin_itemize" == "$end_itemize" ]]
  [[ "$begin_enum" == "$end_enum" ]]
  [[ "$begin_eq" == "$end_eq" ]]
  [[ "$begin_align" == "$end_align" ]]
  [[ "$opens" == "$closes" ]]
}

export -f check_balance
