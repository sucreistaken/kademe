# SDD ledger, plan: docs/superpowers/plans/2026-10-06-hiring-ready-templates.md

Spec: docs/superpowers/specs/2026-10-06-hiring-ready-templates-design.md
Workspace (briefs, reports, packages, git-ignored): .superpowers/sdd/2026-10-06-hiring-ready-templates/
PLAN BASE: 729bd3c

## Pre-flight scan

| Pair / task | Produces vs consumes | Found |
|---|---|---|
| T1 -> T2 | materialise, templateCompetencyKeys, templateByKey, templateCompetency, TEMPLATES, templateMinutes, templateQuestionCount | names and signatures match |
| T1 -> T3..T7 | index.ts TEMPLATES list, build.ts builders, templates.test.ts bar | match; role counts 1+4+3+4+4+4 = 20 |
| T2 -> T8 | templateCards(locale), TemplateCard, start TEMPLATE + templateKey, TEMPLATE_NOT_FOUND | match |
| T2 -> T9 | createOpening TEMPLATE, ensureTemplateCompetencies | match |
| T1 self | test idOf gives RFC v4-shaped uuids; customer-support: 5 questions, 4 open, 3 competencies 40/35/25 | consistent with T2's expected counts |
| T5 self | stage 3 long text says "german_proficiency + role's second key"; test wants exactly 3 competencies | consistent if stage 3 only uses the role's own 3 keys |
| T7 vs T1 test | HR single "which question must not be asked" would put banned phrases (married, religion) in option labels; T1 test bans them in the whole template JSON | conflict |
| T8 self | badge on ChoiceCardGroup without a new shared prop | consistent |
| T9 self | needs local Postgres on 5434 | runs locally here |

Ruling: T7's HR option labels name the topic, not the question ("Adayın medeni durumunu sormak" / "Asking about the candidate's marital status"), so the banned-phrase test stays strict. Why: the test protects every template; an exemption would hide a real violation. Cost if wrong: one reworded question.
Ruling: the project keeps its ledgers in docs/superpowers/ledgers/ (committed), so this file is the ledger; the skill workspace only holds briefs, reports and review packages. Cost if wrong: none, git has both.
