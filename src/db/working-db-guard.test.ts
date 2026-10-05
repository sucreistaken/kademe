import { describe, expect, it } from "vitest";
import { refuseUnlessThrowAwayDb, refuseUnlessWorkingDb } from "./working-db-guard";

describe("refuseUnlessWorkingDb", () => {
  it("accepts the local working database on port 5434", () => {
    expect(refuseUnlessWorkingDb("postgresql://kademe:kademe@localhost:5434/kademe_platform")).toBeNull();
    expect(refuseUnlessWorkingDb("postgresql://kademe:kademe@127.0.0.1:5434/kademe_platform")).toBeNull();
  });

  it("refuses the shared kademe database", () => {
    expect(refuseUnlessWorkingDb("postgresql://kademe:kademe@localhost:5434/kademe")).toMatch(/shared/);
    expect(refuseUnlessWorkingDb("postgresql://kademe:kademe@localhost:5434/kademe?sslmode=disable")).toMatch(/shared/);
  });

  it("refuses any other host", () => {
    expect(refuseUnlessWorkingDb("postgresql://u:p@db.example.com:5434/kademe_platform")).toMatch(/local/);
    expect(refuseUnlessWorkingDb("postgresql://u:p@10.0.0.5:5434/kademe_platform")).toMatch(/local/);
  });

  it("refuses any other port, including the default 5432 and an absent port", () => {
    expect(refuseUnlessWorkingDb("postgresql://u:p@localhost:5432/kademe_platform")).toMatch(/5434/);
    expect(refuseUnlessWorkingDb("postgresql://u:p@localhost/kademe_platform")).toMatch(/5434/);
    expect(refuseUnlessWorkingDb("postgresql://u:p@localhost:5433/kademe_platform")).toMatch(/5434/);
  });

  it("refuses a missing or malformed url instead of throwing", () => {
    expect(refuseUnlessWorkingDb(undefined)).toMatch(/DATABASE_URL/);
    expect(refuseUnlessWorkingDb("")).toMatch(/DATABASE_URL/);
    expect(refuseUnlessWorkingDb("not a url")).toMatch(/DATABASE_URL/);
  });
});

describe("refuseUnlessThrowAwayDb", () => {
  it("accepts a local throw-away database whose name ends in _check", () => {
    expect(refuseUnlessThrowAwayDb("postgresql://kademe:kademe@localhost:5434/kademe_flow_check")).toBeNull();
    expect(refuseUnlessThrowAwayDb("postgresql://kademe:kademe@127.0.0.1:5434/kademe_ui_check")).toBeNull();
  });

  it("refuses the working and the shared database, which are not throw-away", () => {
    expect(refuseUnlessThrowAwayDb("postgresql://kademe:kademe@localhost:5434/kademe_platform")).toMatch(/_check/);
    expect(refuseUnlessThrowAwayDb("postgresql://kademe:kademe@localhost:5434/kademe")).toMatch(/shared/);
  });

  it("keeps every refusal of the working-db guard for a _check name elsewhere", () => {
    expect(refuseUnlessThrowAwayDb("postgresql://u:p@db.example.com:5434/kademe_flow_check")).toMatch(/local/);
    expect(refuseUnlessThrowAwayDb("postgresql://u:p@localhost:5432/kademe_flow_check")).toMatch(/5434/);
    expect(refuseUnlessThrowAwayDb(undefined)).toMatch(/DATABASE_URL/);
  });
});
