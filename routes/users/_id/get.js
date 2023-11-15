import { UserDetailResponseSchema } from "@zod-schema"
import z from "zod"
export const apiDefinition = {
  alias: "getUser",
  description: "Get user detail",
  parameters: [
    {
      name: "id",
      type: "Path",
      description: "User Id",
      schema: z.coerce.number().positive(),
    },
  ],
  response: UserDetailResponseSchema,
  errorStatuses: [400, 403, 404, 500],
}
export default (req, res) => {
  return res.send({
    id: 1,
    name: "Hoi",
    age: 26,
    email: "dangvantho12as0@gmail.com",
  })
}
