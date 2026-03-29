export type ApiContext = {
  ip: string;
  body: Record<string, unknown>;
};

export type Middleware = (req: Request, ctx: ApiContext) => Promise<Response | void>;
