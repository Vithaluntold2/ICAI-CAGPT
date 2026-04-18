# Whiteboard Smoke Test Checklist

Run with `ENABLE_WHITEBOARD_V2=true npm run dev`. Each item must be manually verified in a real browser; type-check and unit tests are necessary but not sufficient.

## Setup

- [ ] Server logs show `WHITEBOARD_V2: true` in the feature-flags output at boot (or equivalent confirmation).
- [ ] `GET /api/features` returns `features.whiteboardV2: true`.

## Chat view — inline rendering

- [ ] Send a message that produces a chart → chart renders inline in the chat bubble at natural full size.
- [ ] Send a message with a GFM table → table renders with shadcn styling.
- [ ] Send a message with a ```ts fenced code block → code is syntax-highlighted and the copy button works.
- [ ] Send a message with LaTeX (`$$E=mc^2$$`) → KaTeX renders.
- [ ] Send a message with a mermaid flowchart → renders inline after post-processing (once Phase 2.4 extraction is wired up).

## Whiteboard view

- [ ] Toggle Chat → Whiteboard via the header pill: URL has `?view=board`; canvas shows all artifacts pre-expanded.
- [ ] Pan and zoom work (wheel, drag-empty-space).
- [ ] Click a card → blue outline appears; selection bar shows "1 selected".
- [ ] Cmd/Ctrl-click additional cards → count increases.
- [ ] Shift-click a later card → range selected.
- [ ] Esc or "Clear" → selection empties.
- [ ] With selection active, the PIP composer bar shows "Referring to: N artifacts"; send a message → preamble is included in the assistant's reply (once Phase 4.6/4.7 wiring is live).

## PIP

- [ ] PIP appears bottom-right on whiteboard view.
- [ ] Drag PIP by its header → stays within viewport bounds.
- [ ] Collapse / expand works; state persists across page reload via `localStorage`.

## Agent awareness (requires Phase 2.4 + 4.6 wiring)

- [ ] After the 2nd message, the server log shows the manifest block included in the system context.
- [ ] Ask "what was in my first chart?" → agent responds with data matching the artifact (evidence it called `read_whiteboard`).

## Exports

- [ ] Export ▾ → XLSX: download opens, contains one sheet per chart, data rows present.
- [ ] Export ▾ → PPTX: download opens, one slide per artifact, image visible.
- [ ] Export ▾ → PDF: download opens, one page per artifact, image visible.
- [ ] Multi-select 2 artifacts → Export → only those 2 appear in the output.

## Backfill

- [ ] Open a pre-existing conversation from before this feature → first load of Whiteboard view shows artifacts derived from prior assistant messages (mermaid blocks).

## Regression (flag off)

- [ ] With `ENABLE_WHITEBOARD_V2=false`: `Chat.tsx` renders exactly as before; `OutputPane` layout unchanged; no view-switcher pill appears.

## Known outstanding integration work at time of checklist creation

- Phase 2.4: wire `buildArtifactsForMessage` into `AIOrchestrator.processQuery` so new assistant messages produce artifact rows.
- Phase 4.6: inject `formatManifest` into the system context each turn; wire the `read_whiteboard` tool into the provider call loop.
- Phase 9.2: mount `ChatViewSwitcher`, `Whiteboard`, `ChatPIP`, `ChatMessageRich`, and the feature flag in `Chat.tsx`.

Until those land, the UI components exist but do not fully self-populate — the checklist items marked "(once Phase X wiring is live)" will not pass yet.
