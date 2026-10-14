/**
 * A candidate's link never goes into message_outbox. The body keeps this
 * placeholder, named by the invitation, where the link would stand; the
 * sender that one day reads the outbox puts a link it makes at send time in
 * its place (inviteLink for an exam, whose token is derived again from the
 * link row; a new link for hiring, whose token is random and only hashed).
 * So a database read alone never yields a working link.
 */
export const outboxLinkPlaceholder = (assessmentId: string) => `{{link:${assessmentId}}}`;
