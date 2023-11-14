import { UserSchema, OrganizationSchema } from "@root/dist/demo/schemas"
import z from "zod"
export const apiDefinition = {
  alias: "getUser",
  description: "get list accounts of organization",
  parameters: [
    {
      name: "userId",
      type: "Path",
      description: "User Id",
      schema: z.coerce.number().positive(),
    },
  ],
  response: UserSchema.merge(
    z.object({
      organization: OrganizationSchema,
    })
  ),
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
