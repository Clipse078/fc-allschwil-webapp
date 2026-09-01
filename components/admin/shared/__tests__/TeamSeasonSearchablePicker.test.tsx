/**
 * @vitest-environment jsdom
 *
 * TRAINING-CENTER-PREMIUM-02 — TeamSeasonSearchablePicker regression tests.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import TeamSeasonSearchablePicker from "@/components/admin/shared/TeamSeasonSearchablePicker";

const OPTIONS = [
  {
    id: "ts-seniorinnen",
    teamId: "team-seniorinnen",
    teamName: "Seniorinnen",
    seasonName: "2025/2026",
    category: "FRAUEN",
  },
  {
    id: "ts-trainingsgruppe",
    teamId: "team-tg",
    teamName: "Trainingsgruppe A",
    seasonName: "2025/2026",
    category: "TRAININGSGRUPPE",
  },
  {
    id: "ts-competitionless",
    teamId: "team-competitionless",
    teamName: "Junioren D-7 D1",
    seasonName: "2025/2026",
    category: "JUNIOREN",
  },
];

describe("TeamSeasonSearchablePicker — single authoritative control", () => {
  it("renders exactly one interactive picker without a legacy native select", () => {
    render(
      <TeamSeasonSearchablePicker
        options={OPTIONS}
        value=""
        onChange={vi.fn()}
        testId="team-picker"
      />,
    );

    expect(screen.getByTestId("team-picker-search")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { hidden: true })).toBeTruthy();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(document.querySelector("select")).toBeNull();
  });

  it("filters options by search and selects via click", () => {
    function Harness() {
      const [value, setValue] = useState("");
      return (
        <TeamSeasonSearchablePicker
          options={OPTIONS}
          value={value}
          onChange={setValue}
          testId="team-picker"
        />
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByTestId("team-picker-search"));
    fireEvent.change(screen.getByTestId("team-picker-search"), { target: { value: "Seniorinnen" } });
    fireEvent.click(screen.getByTestId("team-picker-option-ts-seniorinnen"));

    expect(screen.getByTestId("team-picker-selected")).toHaveTextContent("Seniorinnen");
    expect(screen.queryByTestId("team-picker-listbox")).not.toBeInTheDocument();
  });

  it("supports keyboard navigation and Enter to select", () => {
    const onChange = vi.fn();
    render(
      <TeamSeasonSearchablePicker
        options={OPTIONS}
        value=""
        onChange={onChange}
        testId="team-picker"
      />,
    );

    const input = screen.getByTestId("team-picker-search");
    fireEvent.click(input);
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("ts-seniorinnen");
  });

  it("includes competition-less and Seniorinnen options from data", () => {
    render(
      <TeamSeasonSearchablePicker
        options={OPTIONS}
        value=""
        onChange={vi.fn()}
        testId="team-picker"
      />,
    );

    fireEvent.focus(screen.getByTestId("team-picker-search"));

    expect(screen.getByTestId("team-picker-option-ts-seniorinnen")).toBeInTheDocument();
    expect(screen.getByTestId("team-picker-option-ts-trainingsgruppe")).toBeInTheDocument();
    expect(screen.getByTestId("team-picker-option-ts-competitionless")).toBeInTheDocument();
  });
});
