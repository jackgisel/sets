import { describe, expect, it } from "vitest";
import { parseWorkoutText, wordsToDigits } from "./parse";

describe("wordsToDigits", () => {
  it("converts spoken numbers", () => {
    expect(wordsToDigits("three sets of twelve at one hundred thirty five pounds")).toBe(
      "3 sets of 12 at 135 pounds",
    );
    expect(wordsToDigits("twenty-five push ups")).toBe("25 push ups");
    expect(wordsToDigits("ran a mile")).toBe("ran a mile");
    expect(wordsToDigits("bench at one thirty five")).toBe("bench at 135");
    expect(wordsToDigits("squat two twenty")).toBe("squat 220");
  });
});

describe("parseWorkoutText", () => {
  it("parses a typical spoken log", () => {
    const items = parseWorkoutText(
      "I did 3 sets of 10 bench press at 135 pounds, then ran 3 miles in 25 minutes and 50 pushups",
    );
    expect(items).toEqual([
      { exercise: "Bench press", sets: 3, reps: 10, weight: 135, unit: "lb" },
      { exercise: "Run", duration_min: 25, distance: 3, distance_unit: "mi" },
      { exercise: "Push-ups", sets: 1, reps: 50 },
    ]);
  });

  it("parses shorthand", () => {
    expect(parseWorkoutText("squats 5x5 @ 225")).toEqual([
      { exercise: "Squat", sets: 5, reps: 5, weight: 225, unit: "lb" },
    ]);
    expect(parseWorkoutText("deadlift 3 by 5 140kg")).toEqual([
      { exercise: "Deadlift", sets: 3, reps: 5, weight: 140, unit: "kg" },
    ]);
  });

  it("parses spoken numbers and yesterday", () => {
    expect(parseWorkoutText("Yesterday I did thirty minutes of yoga.")).toEqual([
      { exercise: "Yoga", duration_min: 30, day_offset: -1 },
    ]);
  });

  it("parses durations in hours", () => {
    expect(parseWorkoutText("went for an hour bike ride")[0]).toMatchObject({ exercise: "Bike", duration_min: 60 });
  });

  it("ignores empty filler", () => {
    expect(parseWorkoutText("um, so, yeah")).toEqual([]);
  });
});
