/**
 * JSON Schema for `ExcelWorkbookSpec` — used by Azure/OpenAI's
 * `response_format: { type: "json_schema", strict: true }` so the
 * model's decoder is constrained to emit structurally-valid specs.
 *
 * This is intentionally a SUBSET of the full
 * `ExcelWorkbookSpec` TS type (from
 * [excelWorkbookBuilder.ts](./excelWorkbookBuilder.ts)). We keep the
 * schema focused on fields the LLM is allowed to populate and that
 * matter for correctness — conditional formatting, charts, data
 * validation, etc. are skipped because: (a) the LLM rarely sets
 * them cleanly, (b) their absence doesn't break the workbook, and
 * (c) including them blows up the schema well past OpenAI's
 * strict-mode property-count limit.
 *
 * If you add fields, remember:
 *   - OpenAI strict mode requires `additionalProperties: false` on
 *     EVERY object, and all properties listed in `required`.
 *   - Use `anyOf`/`oneOf` sparingly — they cost nesting depth.
 *   - Keep total schema size under ~15K tokens; shrink by removing
 *     unused optional branches if you hit a limit.
 */

export const EXCEL_WORKBOOK_SPEC_SCHEMA = {
  type: 'object',
  properties: {
    metadata: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        subject: { type: ['string', 'null'] },
        description: { type: ['string', 'null'] },
        author: { type: ['string', 'null'] },
        company: { type: ['string', 'null'] },
        keywords: {
          type: ['array', 'null'],
          items: { type: 'string' },
        },
      },
      required: ['title', 'subject', 'description', 'author', 'company', 'keywords'],
      additionalProperties: false,
    },
    sheets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          purpose: {
            type: 'string',
            enum: ['inputs', 'calculations', 'outputs', 'dashboard', 'data', 'assumptions'],
          },
          tabColor: { type: ['string', 'null'] },
          cells: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                cell: {
                  type: 'string',
                  description: 'A1 notation — column letter(s) + row number, e.g. "B7"',
                },
                type: {
                  type: 'string',
                  enum: ['label', 'input', 'formula', 'value', 'header', 'subheader', 'total'],
                },
                value: {
                  type: ['string', 'number', 'boolean', 'null'],
                  description: 'For label/value/header types, or a literal numeric input. Null when a formula is provided.',
                },
                formula: {
                  type: ['string', 'null'],
                  description: 'Excel formula starting with =. Must reference same-or-earlier-row col-B cells.',
                },
                // `formulaPattern` is intentionally omitted from the
                // strict schema — OpenAI strict mode cannot express a
                // free-form key/value map for the `params` field (it
                // requires every property to be enumerated upfront),
                // and enumerating every possible pattern param would
                // bloat the schema. The LLM can express every pattern
                // it needs via the plain `formula` field instead;
                // formula-pattern resolution still works at runtime
                // when the LLM chooses to emit it, just not gated by
                // the schema decoder. We keep this property absent
                // rather than `null`-only so strict mode is happy
                // AND the LLM doesn't waste tokens emitting nulls.
                name: {
                  type: ['string', 'null'],
                  description: 'Named range for this cell (column B inputs only).',
                },
                format: {
                  anyOf: [
                    {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          enum: ['number', 'currency', 'percentage', 'date', 'text', 'accounting', 'scientific'],
                        },
                        decimals: { type: ['number', 'null'] },
                        currencySymbol: { type: ['string', 'null'] },
                        negativeRed: { type: ['boolean', 'null'] },
                        thousandsSeparator: { type: ['boolean', 'null'] },
                      },
                      required: ['type', 'decimals', 'currencySymbol', 'negativeRed', 'thousandsSeparator'],
                      additionalProperties: false,
                    },
                    { type: 'null' },
                  ],
                },
                comment: { type: ['string', 'null'] },
              },
              required: ['cell', 'type', 'value', 'formula', 'name', 'format', 'comment'],
              additionalProperties: false,
            },
          },
          // `columnWidths` is a free-form {A: 32, B: 18, …} map.
          // OpenAI strict mode doesn't allow `additionalProperties`
          // with a type schema, and enumerating every column letter
          // blows up the schema. Omitted — the builder applies sane
          // defaults.
          freezePanes: {
            anyOf: [
              {
                type: 'object',
                properties: {
                  row: { type: 'number' },
                  col: { type: 'number' },
                },
                required: ['row', 'col'],
                additionalProperties: false,
              },
              { type: 'null' },
            ],
          },
          mergedCells: {
            type: ['array', 'null'],
            items: { type: 'string' },
          },
        },
        required: ['name', 'purpose', 'tabColor', 'cells', 'freezePanes', 'mergedCells'],
        additionalProperties: false,
      },
    },
    namedRanges: {
      type: ['array', 'null'],
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          range: {
            type: 'string',
            description: 'A1-notation range, e.g. "Assumptions!B3"',
          },
          scope: { type: ['string', 'null'] },
          comment: { type: ['string', 'null'] },
        },
        required: ['name', 'range', 'scope', 'comment'],
        additionalProperties: false,
      },
    },
  },
  required: ['metadata', 'sheets', 'namedRanges'],
  additionalProperties: false,
} as const;

/**
 * A stable seed used for Stage 1 + Stage 3 Excel generation so that
 * an identical request produces the same structural output — makes
 * failures reproducible. Regenerate by incrementing when changing
 * the prompt deliberately if you want to flush the cache.
 */
export const EXCEL_GENERATION_SEED = 20260422;
