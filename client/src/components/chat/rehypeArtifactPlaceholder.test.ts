import { describe, it, expect } from "vitest";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import { rehypeArtifactPlaceholder } from "./rehypeArtifactPlaceholder";
import { visit } from "unist-util-visit";

function transform(html: string): any {
  const tree = unified().use(rehypeParse, { fragment: true }).parse(html);
  rehypeArtifactPlaceholder()(tree);
  return tree;
}

describe("rehypeArtifactPlaceholder", () => {
  it("rewrites <artifact id='x'></artifact> into an artifact-placeholder element with id", () => {
    const tree = transform('<p>See <artifact id="art_1"></artifact></p>');
    let found = 0;
    visit(tree, "element", (node: any) => {
      if (node.tagName === "artifact-placeholder" && node.properties?.id === "art_1") found++;
    });
    expect(found).toBe(1);
  });

  it("ignores regular elements", () => {
    const tree = transform("<p>hello <strong>world</strong></p>");
    let found = 0;
    visit(tree, "element", (node: any) => {
      if (node.tagName === "artifact-placeholder") found++;
    });
    expect(found).toBe(0);
  });

  it("strips children from the artifact element", () => {
    const tree = transform('<p><artifact id="x">should be removed</artifact></p>');
    visit(tree, "element", (node: any) => {
      if (node.tagName === "artifact-placeholder") {
        expect(node.children).toEqual([]);
      }
    });
  });
});
