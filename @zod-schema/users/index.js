import { UserSchema, OrganizationSchema } from "@root/dist/demo/schemas"
import z from "zod"

export const CreateUserSchemaBody = UserSchema.omit({
  id: true,
  createdDatetime: true,
  updatedDatetime: true,
})

export const UserDetailResponseSchema = UserSchema.merge(
  z.object({
    organization: OrganizationSchema,
  })
)

export { UserSchema }
