import { accountant } from "./roles/accountant";
import { callCenterAgent } from "./roles/call-center-agent";
import { customerSupport } from "./roles/customer-support";
import { examPrepTeacher } from "./roles/exam-prep-teacher";
import { executiveAssistant } from "./roles/executive-assistant";
import { fieldSalesRepresentative } from "./roles/field-sales-representative";
import { germanTeacherAdult } from "./roles/german-teacher-adult";
import { germanTeacherYoungLearners } from "./roles/german-teacher-young-learners";
import { hrSpecialist } from "./roles/hr-specialist";
import { marketingSpecialist } from "./roles/marketing-specialist";
import { onlineGermanTeacher } from "./roles/online-german-teacher";
import { productDesigner } from "./roles/product-designer";
import { retailSalesAssociate } from "./roles/retail-sales-associate";
import { salesRepresentative } from "./roles/sales-representative";
import { softwareDeveloper } from "./roles/software-developer";
import { warehouseLogistics } from "./roles/warehouse-logistics";
import type { HiringTemplate } from "./types";

/** Gallery order: generic roles, then language-school roles, then the extra roles. */
export const TEMPLATES: HiringTemplate[] = [customerSupport, salesRepresentative, callCenterAgent, accountant, executiveAssistant, softwareDeveloper, retailSalesAssociate, warehouseLogistics, germanTeacherAdult, examPrepTeacher, germanTeacherYoungLearners, onlineGermanTeacher, hrSpecialist, marketingSpecialist, productDesigner, fieldSalesRepresentative];

export const templateByKey = (key: string): HiringTemplate | null => TEMPLATES.find((x) => x.key === key) ?? null;

const norm = (s: string) => s.trim().toLocaleLowerCase("tr");
/** A position whose name is a template's name (TR or EN) preselects that template. */
export function matchTemplate(positionName: string): HiringTemplate | null {
  const wanted = norm(positionName);
  if (!wanted) return null;
  return TEMPLATES.find((x) => norm(x.name.tr) === wanted || norm(x.name.en) === wanted) ?? null;
}
