import { createInterface } from "node:readline";
import { hash, verify } from "@node-rs/argon2";

/**
 * Turns the panel password into the value of `PANEL_PASSWORD_HASH`.
 *
 *   pnpm panel:hash                      # asks twice, input hidden
 *   printf '%s' "$PW" | pnpm -s panel:hash   # reads stdin, no newline needed
 *
 * Prints one line, the argon2 hash base64url-encoded. The encoding is there
 * because a raw argon2 hash is full of `$`, which Next's .env loader expands
 * even inside single quotes, and a shell expands unless single-quoted. The
 * app accepts either form.
 *
 * The password is never echoed, logged or written anywhere by this script.
 */

const MIN_LENGTH = 12;

/** Same argon2id cost as `hashPassword` in src/lib/auth.ts, which cannot be
 *  imported here because it opens a database connection on load. */
const hashPassword = (plain: string) =>
  hash(plain, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
const verifyPassword = verify;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  // Drop one trailing newline from `echo`; anything else is part of the password.
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    const output = rl as unknown as { _writeToOutput: (s: string) => void };
    let prompted = false;
    output._writeToOutput = (s: string) => {
      if (!prompted) {
        process.stderr.write(s);
        prompted = true;
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stderr.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  let password: string;
  if (process.stdin.isTTY) {
    password = await askHidden("Panel password: ");
    const again = await askHidden("Again: ");
    if (password !== again) {
      console.error("The two entries differ. Nothing printed.");
      process.exit(1);
    }
  } else {
    password = await readStdin();
  }

  if (password.length < MIN_LENGTH) {
    console.error(`The panel password must be at least ${MIN_LENGTH} characters. Nothing printed.`);
    process.exit(1);
  }

  const digest = await hashPassword(password);
  if (!(await verifyPassword(digest, password))) {
    console.error("Self-check failed. Nothing printed.");
    process.exit(1);
  }

  process.stdout.write(`${Buffer.from(digest, "utf8").toString("base64url")}\n`);
  console.error("Set it on the server as PANEL_PASSWORD_HASH=<the line above>, then restart the app.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "panel:hash failed");
  process.exit(1);
});
