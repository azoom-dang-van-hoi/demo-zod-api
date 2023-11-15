import { z } from "zod"
export const ResponseSchemas = {
  200: {
    status: 200,
    schema: z.object({ message: z.string() }),
  },
  201: {
    status: 201,
    schema: z.object({ message: z.string() }),
  },
  202: {
    status: 202,
    schema: z.object({ message: z.string() }),
  },
  204: {
    status: 204,
    schema: z.object({ message: z.string() }),
  },
  400: {
    status: 400,
    schema: z.object({
      context: z.string(),
      error: z
        .object({
          code: z.string(),
          expected: z.string(),
          received: z.string(),
          path: z.string().array(),
          message: z.string(),
        })
        .array(),
    }),
  },
  401: {
    status: 401,
    schema: z.object({ message: z.string() }),
  },
  403: {
    status: 403,
    schema: z.object({ message: z.string() }),
  },
  404: {
    status: 404,
    schema: z.object({ message: z.string() }),
  },
  409: {
    status: 409,
    schema: z.object({ message: z.string() }),
  },
  500: {
    status: 500,
    schema: z.object({ message: z.string() }),
  },
  503: {
    status: 503,
    schema: z.object({ message: z.string() }),
  },
}
