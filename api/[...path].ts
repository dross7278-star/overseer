import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method !== "GET") {
    response.setHeader("allow", "GET");
    response.status(405).json({ error: "This public API is read-only." });
    return;
  }

  const backendUrl = process.env.OVERSEER_API_URL;
  if (!backendUrl) {
    response.status(500).json({ error: "The OVERSEER_API_URL environment variable is required." });
    return;
  }

  const incomingUrl = new URL(request.url ?? "/", "https://vercel.local");
  const destination = new URL(
    `${incomingUrl.pathname}${incomingUrl.search}`,
    `${backendUrl.replace(/\/+$/, "")}/`,
  );

  try {
    const upstream = await fetch(destination, {
      method: "GET",
      headers: { accept: "application/json" },
    });
    response.status(upstream.status);
    response.setHeader(
      "content-type",
      upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
    );
    response.setHeader("cache-control", "no-store");
    response.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error("Unable to reach the Overseer API.", error);
    response.status(502).json({ error: "The Overseer API could not be reached." });
  }
}
