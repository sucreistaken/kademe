const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Which fields the core /info route would refuse, by the same rules (NAME_REQUIRED, EMAIL_INVALID). */
export function infoProblems(form: { fullName: string; email: string }): { name: boolean; email: boolean } {
  return { name: form.fullName.trim().length < 2, email: !EMAIL.test(form.email.trim()) };
}

/** 3.12: the button waits for what the core /info route would refuse, in the same order (NAME_REQUIRED, EMAIL_INVALID). */
export function infoWaitReason(form: { fullName: string; email: string }): "name" | "email" | null {
  const problems = infoProblems(form);
  if (problems.name) return "name";
  if (problems.email) return "email";
  return null;
}
