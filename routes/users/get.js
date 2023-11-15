import { prisma } from "@root/database"
import { UserSchema } from "@zod-schema"
export const apiDefinition = {
  alias: "getUsers",
  description: "Get list user",
  response: UserSchema.array(),
  errorStatuses: [400, 403, 404, 500],
}

export default async (req, res) => {
  const users = await prisma.user.findMany()
  return res.send(users)
}
