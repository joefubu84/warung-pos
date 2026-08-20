import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Production test dummy function
export const runRLSTest = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({
    userId: z.string().uuid()
  }).parse(data))
  .handler(async () => {
    return { message: "Security guard active." };
  });
