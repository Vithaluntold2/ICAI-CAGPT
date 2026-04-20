import { describe, it, expect } from "vitest";
import { extractChecklist } from "./checklist";

describe("extractChecklist", () => {
  it("returns null when no checklist markers present", () => {
    expect(extractChecklist("just prose without checkboxes")).toBeNull();
  });

  it("extracts plain checkbox list", () => {
    const content = `# Year-End Close

- [ ] Reconcile bank statements
- [ ] Review accruals
- [x] Post depreciation`;
    const res = extractChecklist(content);
    expect(res).not.toBeNull();
    expect(res!.title).toBe("Year-End Close");
    expect(res!.items).toHaveLength(3);
    expect(res!.items[0].label).toBe("Reconcile bank statements");
    expect(res!.items[0].defaultChecked).toBe(false);
    expect(res!.items[2].defaultChecked).toBe(true);
  });

  it("pulls content from <DELIVERABLE> when present", () => {
    const content = `Here is your checklist:
<DELIVERABLE>
# Tax Audit Checklist

## Preliminary

- [ ] Obtain Form 3CA/3CB
- [ ] Verify books
</DELIVERABLE>
And some reasoning text after.`;
    const res = extractChecklist(content);
    expect(res).not.toBeNull();
    expect(res!.title).toBe("Tax Audit Checklist");
    expect(res!.items).toHaveLength(2);
    expect(res!.items[0].section).toBe("Preliminary");
  });

  it("attaches indented continuation as hint", () => {
    const content = `- [ ] File GSTR-1
    Due by 11th of next month
- [ ] File GSTR-3B`;
    const res = extractChecklist(content);
    expect(res).not.toBeNull();
    expect(res!.items[0].hint).toBe("Due by 11th of next month");
    expect(res!.items[1].hint).toBeUndefined();
  });

  it("assigns stable slugged ids", () => {
    const content = `- [ ] Reconcile bank statements
- [ ] Review accruals`;
    const res = extractChecklist(content);
    expect(res!.items[0].id).toContain("reconcile-bank-statements");
    expect(res!.items[1].id).toContain("review-accruals");
    // uniqueness
    expect(res!.items[0].id).not.toBe(res!.items[1].id);
  });
});
