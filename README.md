# Demo zod api

## Environment:
    - Node 18
        + nvm install 18
        + nvm alias default 18
    - Docker

## Setup: Run commands
1, `yarn` Install packages

2, `yarn prisma:migrate` sync Prisma model with database

## Run API:
####  `yarn dev`

## Migrations:
1, Edit the model in ./prisma/schema.prisma

2, Create migration file `yarn prisma migrate dev --create-only --name <name_file>`

3, Run migration `yarn prisma:migrate`

## Other notes:

- To define a route definition, create a const named apiDefinition and add necessary properties to it. For example:
```
export const apiDefinition = {
  alias: 'defaultGet',
  description: 'Default Get endpoint',
  parameters: [
    {
      name: 'example-query-param',
      type: 'Query',
      description: 'example query param',
      schema: z.number()
    }
  ],
  response: z.object({
    message: z.string()
  })
}
```
The required properties is `response`. The description, parameters and alias are optional. But the alias must be unique through the app.

Inside the parameters, the `name`, `type` and `schema` are required. The `description` is optional.

Type must be one of `Query`, `Body`, `Path`, `Header`.

The `schema` is the zod schema of the parameter. For example: `z.number()`

- The schema is generated automatically using modified version [zod-prisma-types](https://github.com/chrishoermann/zod-prisma-types) to support japanese. The usage will be the same as the original version. For example:
```
model User {
  id       Int    @id @default(autoincrement())
  email    String @unique /// @zod.string.regex(/^([\w-.]+@([\w-]+\.)+[\w-]{2,4})*$/, { message: "メールアドレスを入力してください" } )
  name     String @map("name") @db.VarChar(255) /// @zod.string.min(1, { message: "未入力です" })
  nameKana String @map("name_kana") @db.VarChar(255) /// @zod.string.min(1, { message: "未入力です" }).regex(/^[ァ-ンｧ-ﾝﾞﾟー 　]*$/, { message: "カナでご入力してください" })
}
```

The plugin will read the comment `/// @zod` and extract the content to the actual zod schema file. 

- There is an issue with zod and zod-prisma-types, so the version is fixed. Will update later.

- To share the auto-generated Zod schemas from the Prisma model to the frontend app, run the command:
    ```
    npm run lib:publish
    ```

- To view the above generated code (for debugging purpose), run the command:
    ```
    yarn lib:build
    ```
- Zod schema must be write in folder `@zod-schema`

- This project use tsc and tsc-alias for build prisma to zod schema


