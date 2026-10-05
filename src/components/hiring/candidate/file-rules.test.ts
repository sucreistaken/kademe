import { describe, expect, it } from "vitest";
import { DEFAULT_MAX_FILE_BYTES } from "@/solutions/hiring/rules/candidate-flow";
import { acceptAttr, fileProblem, megabytes, mimeLabel, mimeOf, sizeLabel, typeList } from "./file-rules";

describe("what a file question takes (HIRING-UX 6.9)", () => {
  it("names types the way people know them", () => {
    expect(mimeLabel("application/pdf")).toBe("PDF");
    expect(mimeLabel("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("DOCX");
    expect(mimeLabel("image/png")).toBe("PNG");
    expect(mimeLabel("text/csv")).toBe("CSV");
    expect(typeList(["application/pdf", "image/png", "image/jpeg"], "en")).toBe("PDF, PNG or JPG");
    expect(typeList(["application/pdf", "image/png", "image/jpeg"], "tr")).toBe("PDF, PNG veya JPG");
    expect(typeList([], "tr")).toBeNull();
  });

  it("says the size in megabytes in the candidate's language", () => {
    expect(megabytes(20 * 1024 * 1024, "tr")).toBe("20");
    expect(megabytes(1.5 * 1024 * 1024, "tr")).toBe("1,5");
    expect(megabytes(1.5 * 1024 * 1024, "en")).toBe("1.5");
  });

  it("refuses a wrong type, a file over the size and an empty file before uploading", () => {
    expect(fileProblem({ type: "image/png", size: 10 }, ["application/pdf"], 1000)).toBe("type");
    expect(fileProblem({ type: "application/pdf", size: 1001 }, ["application/pdf"], 1000)).toBe("size");
    expect(fileProblem({ type: "application/pdf", size: 0 }, ["application/pdf"], 1000)).toBe("empty");
    expect(fileProblem({ type: "application/pdf", size: 10 }, ["application/pdf"], 1000)).toBeNull();
    expect(fileProblem({ type: "", size: 10 }, null, null)).toBeNull();
  });

  it("uses the server's default size when the question sets none (C19: one constant)", () => {
    expect(fileProblem({ type: "application/pdf", size: DEFAULT_MAX_FILE_BYTES }, null, null)).toBeNull();
    expect(fileProblem({ type: "application/pdf", size: DEFAULT_MAX_FILE_BYTES + 1 }, null, null)).toBe("size");
  });

  it("compares types the way the server does: lower case, without parameters", () => {
    expect(fileProblem({ type: "Application/PDF", size: 10 }, ["application/pdf"], 1000)).toBeNull();
    expect(fileProblem({ type: "text/csv; charset=utf-8", size: 10 }, ["text/csv"], 1000)).toBeNull();
  });

  it("knows a file's type from its name when the browser leaves it empty (a .docx on Windows without Office)", () => {
    expect(mimeOf({ type: "", name: "Plan.DOCX" })).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(mimeOf({ type: "", name: "plan.jpeg" })).toBe("image/jpeg");
    expect(mimeOf({ type: "application/pdf", name: "plan.bin" })).toBe("application/pdf");
    expect(mimeOf({ type: "", name: "notes" })).toBe("");
  });

  it("declares the extension's type when the browser's is not accepted but the extension's is (Windows aliases, fix round 1, I3)", () => {
    expect(mimeOf({ type: "application/vnd.ms-excel", name: "veriler.csv" }, ["text/csv"])).toBe("text/csv");
    expect(mimeOf({ type: "application/x-zip-compressed", name: "proje.ZIP" }, ["application/zip", "application/pdf"])).toBe("application/zip");
    // An accepted browser type stays as it is.
    expect(mimeOf({ type: "application/vnd.ms-excel", name: "tablo.xls" }, ["application/vnd.ms-excel", "text/csv"])).toBe("application/vnd.ms-excel");
    // A truly wrong type is still refused: neither the type nor the extension is on the list.
    const png = mimeOf({ type: "image/png", name: "ekran.png" }, ["application/pdf"]);
    expect(png).toBe("image/png");
    expect(fileProblem({ type: png, size: 10 }, ["application/pdf"], 1000)).toBe("type");
    // An alias whose extension is not on the list either stays refused.
    const xls = mimeOf({ type: "application/vnd.ms-excel", name: "tablo.xls" }, ["text/csv"]);
    expect(fileProblem({ type: xls, size: 10 }, ["text/csv"], 1000)).toBe("type");
  });

  it("says a file's own size: kilobytes under a megabyte, never 0", () => {
    expect(sizeLabel(13, "tr")).toBe("1 KB");
    expect(sizeLabel(340 * 1024, "en")).toBe("340 KB");
    expect(sizeLabel(1.5 * 1024 * 1024, "tr")).toBe("1,5 MB");
    expect(sizeLabel(1.5 * 1024 * 1024, "en")).toBe("1.5 MB");
  });

  it("filters the picker by type and by extension", () => {
    expect(acceptAttr(["application/pdf", "image/jpeg"])).toBe("application/pdf,.pdf,image/jpeg,.jpg,.jpeg");
    expect(acceptAttr(["application/x-unknown"])).toBe("application/x-unknown");
    expect(acceptAttr(null)).toBeUndefined();
    expect(acceptAttr([])).toBeUndefined();
  });
});
