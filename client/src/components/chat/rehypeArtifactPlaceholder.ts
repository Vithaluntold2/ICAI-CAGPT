import { visit } from "unist-util-visit";

export function rehypeArtifactPlaceholder() {
  return (tree: any) => {
    visit(tree, "element", (node: any) => {
      if (node.tagName === "artifact") {
        node.tagName = "artifact-placeholder";
        node.properties = { id: node.properties?.id };
        node.children = [];
      }
    });
  };
}
