/** Minimal Express req/res doubles: enough to call a handler and read what it answered. */
export interface FakeRes {
  locals: { userId: string };
  statusCode: number;
  body: unknown;
  status: (code: number) => FakeRes;
  json: (body: unknown) => FakeRes;
}

export const fakeRes = (userId: string): FakeRes => {
  const res: FakeRes = {
    locals: { userId },
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
};

/** Runs a handler as the given user and returns the response and any error passed to next(). */
export const call = async (
  handler: (req: never, res: never, next: never) => unknown,
  userId: string,
  body: Record<string, unknown> = {}
) => {
  const res = fakeRes(userId);
  const errors: unknown[] = [];
  await handler(
    { body: { token: "t", ...body }, query: {}, params: {} } as never,
    res as never,
    ((e: unknown) => errors.push(e)) as never
  );
  return { res, status: res.statusCode, body: res.body, errors };
};
