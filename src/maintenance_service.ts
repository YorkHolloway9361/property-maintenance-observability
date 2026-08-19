import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiError } from "./infrai_errors.js";
import { processMaintenanceRequest } from "./maintenance_intake.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  response.setHeader("content-type", "application/json");
  if (request.method !== "POST" || request.url !== "/maintenance-requests") {
    response.writeHead(404).end(JSON.stringify({ error: "route not found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const result = await processMaintenanceRequest(body, new Date().toISOString().slice(0, 10));
    response.writeHead(201).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "invalid request body" }));
      return;
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      response.writeHead(error.status).end(JSON.stringify({ error: error.message }));
      return;
    }
    response.writeHead(500).end(JSON.stringify({ error: "maintenance intake failed" }));
  }
});

server.listen(port, () => console.log(`maintenance intake listening on http://localhost:${port}`));
