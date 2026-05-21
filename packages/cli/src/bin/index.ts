#!/usr/bin/env bun
import { CliUsageError } from "@herbert/cli/cli/CliUsageError";
import { renderUsage, runHerbertCli } from "@herbert/cli/cli/runHerbertCli";
import pc from "picocolors";

try {
  await runHerbertCli({
    argv: process.argv.slice(2),
  });
} catch (error) {
  if (error instanceof CliUsageError) {
    process.stderr.write(`${pc.red(error.message)}\n\n`);
    process.stderr.write(renderUsage());
    process.exitCode = 1;
  } else if (error instanceof Error) {
    process.stderr.write(`${pc.red(error.stack ?? error.message)}\n`);
    process.exitCode = 1;
  } else {
    process.stderr.write(`${pc.red(String(error))}\n`);
    process.exitCode = 1;
  }
}
