import type { FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";

export interface ParsedBody<T = Record<string, any>> {
  data: T;
  file?: MultipartFile;
}

/**
 * Supports both:
 *  - multipart/form-data: JSON in the `data` field, image in the `file` part
 *    (any other plain text fields are merged into data)
 *  - application/json: req.body is used as data
 */
export const parseBodyAndFile = async <T = Record<string, any>>(
  req: FastifyRequest
): Promise<ParsedBody<T>> => {
  if (!req.isMultipart()) {
    return { data: ((req.body as T) ?? ({} as T)) };
  }

  let data: Record<string, any> = {};
  let file: MultipartFile | undefined;

  for await (const part of req.parts()) {
    if (part.type === "file") {
      if (part.fieldname === "file" && !file) {
        // The stream must be consumed while iterating.
        // toBuffer() caches the result, so the service can call it again.
        await part.toBuffer();
        file = part;
      } else {
        await part.toBuffer(); // drain unexpected files
      }
      continue;
    }

    const value = part.value as string;

    if (part.fieldname === "data") {
      try {
        data = { ...data, ...JSON.parse(value) };
      } catch {
        throw Object.assign(new Error("Invalid JSON in 'data' field"), {
          statusCode: 400,
        });
      }
    } else {
      data[part.fieldname] = value;
    }
  }

  return { data: data as T, file };
};