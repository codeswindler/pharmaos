import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
const host = process.env["HOST"] ?? "127.0.0.1";

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, host, () => {
  logger.info({ host, port }, "Server listening");
});

server.on("error", (err) => {
  if (err instanceof Error) {
    logger.error({ err }, "Error listening on port");
  } else {
    logger.error({ err: String(err) }, "Error listening on port");
  }
  process.exit(1);
});
