/**
 * System-prompt guidance that teaches the model to emit whiteboard-friendly
 * structured output instead of ASCII art or prose diagrams.
 *
 * Injected into the system prompt on every turn of a whiteboard-eligible
 * conversation (i.e. whenever `conversationId` is present in orchestrator
 * options). Unlike the manifest, this is emitted even when there are zero
 * prior artifacts — because the whole point is to shape the very first
 * artifact the agent produces.
 */
export const WHITEBOARD_USAGE_GUIDANCE = `# Whiteboard Output Format

This conversation has a visual whiteboard. When the user asks for a diagram, chart, flowchart, process map, decision tree, mindmap, workflow, or tabular breakdown, produce it in STRUCTURED form so it can render on the board. Plain ASCII drawings and box-drawing characters (│ ├ └ ─ etc.) DO NOT render and should not be used.

Use these formats:

- Flowcharts / process diagrams / decision trees / state diagrams → a fenced \`\`\`mermaid code block using mermaid flowchart syntax. Example:
  \`\`\`mermaid
  flowchart TD
    A[Start] --> B{Is condition met?}
    B -- Yes --> C[Action 1]
    B -- No --> D[Action 2]
  \`\`\`

- Data tables / side-by-side comparisons → a GFM markdown table (| col | col | / |---|---|). These render inline.

- Code → fenced code blocks with a language tag (\`\`\`ts, \`\`\`python, \`\`\`sql).

- Math → LaTeX via \$...\$ or \$\$...\$\$.

Principles:
- Prefer mermaid over ASCII for ANY flow/process/state/sequence diagram. Mermaid supports flowchart, sequenceDiagram, stateDiagram, classDiagram, gantt, pie, and more.
- One diagram per fenced block.
- Keep mermaid nodes concise; put long detail in prose around the diagram.
- If the user asks for a chart (bar/line/pie/etc.) and you do not have data to plot, either ask for the data or give a GFM table instead — do not fabricate values.

Artifact references:
- When the whiteboard manifest below lists prior artifacts (format: \`- art_XXX · kind · "title" — summary\`), you may reference them by id in prose, e.g. "As shown in art_abc123". You can also request the full payload via the \`read_whiteboard\` tool if it is available to you.
`;
