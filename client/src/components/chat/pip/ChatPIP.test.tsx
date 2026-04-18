// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatPIP } from "./ChatPIP";

describe("ChatPIP", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders transcript and composer by default", () => {
    render(<ChatPIP messages={[{ id: "1", role: "user", content: "hi" }]} byId={{}} onSend={vi.fn()} />);
    expect(screen.getByTestId("pip-transcript")).toBeInTheDocument();
    expect(screen.getByTestId("composer")).toBeInTheDocument();
    expect(screen.getByText("hi")).toBeInTheDocument();
  });

  it("collapses to header only when collapse toggled", () => {
    render(<ChatPIP messages={[]} byId={{}} onSend={vi.fn()} />);
    fireEvent.click(screen.getByTestId("chat-pip-collapse"));
    expect(screen.queryByTestId("pip-transcript")).not.toBeInTheDocument();
    expect(screen.queryByTestId("composer")).not.toBeInTheDocument();
  });

  it("renders artifact chip from transcript placeholder", () => {
    const byId = {
      art_1: { id: "art_1", title: "Q3 Chart" } as any,
    };
    render(
      <ChatPIP
        messages={[{ id: "m1", role: "assistant", content: 'See <artifact id="art_1"/> for details.' }]}
        byId={byId}
        onSend={vi.fn()}
      />
    );
    expect(screen.getByText(/📊 Q3 Chart — on board/)).toBeInTheDocument();
  });
});
