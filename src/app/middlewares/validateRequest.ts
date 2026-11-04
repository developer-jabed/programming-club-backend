import type { FastifyRequest, FastifyReply } from "fastify";
import { z, ZodError } from "zod";

const validateRequest = (schema: z.ZodType) => {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      const parsed = (await schema.parseAsync({
        body: request.body,
        query: request.query,
        params: request.params,
      })) as any;

      // Use the cleaned values (trim / coerce / preprocess) downstream
      if (parsed?.body !== undefined) request.body = parsed.body;
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues.map((e) => ({
          field: e.path.filter((p) => p !== "body").join("."),
          message: e.message,
        }));

        // Field map for the frontend: { status: "...", score: "..." }
        const errors: Record<string, string> = {};
        for (const i of issues) {
          if (!errors[i.field || "_"]) errors[i.field || "_"] = i.message;
        }

        request.log.warn({ issues: err.issues }, "validation failed");

        reply.status(400).send({
          success: false,
          message: `Validation error: ${issues
            .map((i) => (i.field ? `${i.field}: ${i.message}` : i.message))
            .join("; ")}`,
          errors,
          error: issues, // kept for any client still reading `error`
        });
        return;
      }
      reply.send(err);
    }
  };
};

export default validateRequest;