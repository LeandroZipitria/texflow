# Other Sensitive Write Paths

## `updateEmptyFrameBody`

- Range: the entire body of an empty frame, derived from `ctx.frame.raw.indexOf(ctx.frame.body)`
- Risk: low if the frame parse is current, higher if `frame.body` offsets are stale
- Structural delimiters touched: only the region between `\begin{frame}` and `\end{frame}`

## `updateBlock`

- Range: parsed block span computed from `block.start` and `block.end`
- Risk: moderate, because the serialization is applied at exact offsets that depend on current parsing
- Structural delimiters touched: block-local, but a stale parse can spill toward `\end{frame}`

## `saveSource`

- Range: the entire document contents from `0` to `document.getText().length`
- Risk: highest, because it rewrites the full file and can invalidate any stale Visual references

## `insertFrame`

- Range: insertion before `\end{document}` or after the current frame
- Risk: moderate, because it writes near structural sentinels

## `insertHeading`

- Range: insertion before the current frame end or before `\end{document}`
- Risk: moderate, especially if current frame context is stale

## `insertMathInFrame`

- Range: insertion immediately before `\end{frame}`
- Risk: localized, but still sentinel-adjacent

## `insertBlockInFrame`

- Range: insertion immediately before `\end{frame}`
- Risk: localized, but still sentinel-adjacent
