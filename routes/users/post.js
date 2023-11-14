import { UserSchema } from "@root/dist/demo/schemas"
export const apiDefinition = {
  alias: "createUser",
  description: "Create user",
  parameters: [
    {
      name: "user",
      type: "Body",
      description: "User infor",
      schema: UserSchema.omit({
        id: true,
        createdDatetime: true,
        updatedDatetime: true,
      }),
    },
  ],
  response: UserSchema,
  errorStatuses: [400, 403, 404, 500],
}
export default (req, res) => {
  return res.send({
    id: Math.floor(Math.random() * 1000000),
    ...req.body,
  })
}
