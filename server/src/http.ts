export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

export function errorResponse(status: number, message: string): Response {
  return json({ error: message }, { status });
}
