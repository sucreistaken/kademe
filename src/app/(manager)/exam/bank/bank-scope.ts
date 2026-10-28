import { and, eq, isNull } from "drizzle-orm";
import { items } from "@/db/schema";

/**
 * What the bank screen may read or write: the organisation's own bank. Course
 * test rows (course_form set, spec 2026-10-28) belong to their form; they are
 * not listed, counted, opened, edited, approved or retired here, whatever the
 * address or request says. Every items query of this folder starts from this
 * condition (bank-scope.test.ts keeps it that way).
 */
export const bankItem = (orgId: string) => and(eq(items.orgId, orgId), isNull(items.courseForm));
