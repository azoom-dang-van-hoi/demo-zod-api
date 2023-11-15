import { UserSchema, OrganizationSchema } from "@root/dist/demo/schemas"
import z from "zod"

export const CreateUserSchemaBody = UserSchema.omit({
  id: true,
  createdDatetime: true,
  updatedDatetime: true,
}).merge(
  z.object({
    organizationId: z.coerce.number().positive(),
    age: z.coerce
      .number({
        invalid_type_error: "Age is not a number",
      })
      .positive({ message: "Age must be greater 0" }),
  })
)

export const UserDetailResponseSchema = UserSchema.merge(
  z.object({
    organization: OrganizationSchema,
  })
)

export { UserSchema }
