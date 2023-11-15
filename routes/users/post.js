import { prisma } from "@root/database"
import { UserSchema, CreateUserSchemaBody } from "@zod-schema"
export const apiDefinition = {
  alias: "createUser",
  description: "Create user",
  parameters: [
    {
      name: "user",
      type: "Body",
      description: "User infor",
      schema: CreateUserSchemaBody,
    },
  ],
  response: UserSchema,
  errorStatuses: [400, 403, 404, 500],
}

export default async (req, res) => {
  console.log(req.body)
  const createdUser = await prisma.user.create({ data: req.body })
  return res.send(createdUser)
}
