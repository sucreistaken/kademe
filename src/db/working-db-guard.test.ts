import { describe, expect, it } from "vitest";
import { refuseUnlessWorkingDb } from "./working-db-guard";

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
