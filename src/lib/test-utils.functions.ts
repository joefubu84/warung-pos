import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const createTestUsers = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    users: z.array(z.object({
      email: z.string().email(),
      password: z.string()
    }))
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: any[] = [];
    
    for (const user of data.users) {
      try {
        console.log(`DEBUG: Processing ${user.email} in ${process.env['SUPABASE_URL']}`);
        
        // Use a case-insensitive search to be sure
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;
        
        const found = listData?.users?.find((u: any) => u.email?.toLowerCase() === user.email.toLowerCase());
        
        if (found) {
          console.log(`DEBUG: Found existing user ${user.email} with ID ${found.id}`);
          results.push({ email: user.email, id: found.id, status: "exists" });
          continue;
        }

        console.log(`DEBUG: Creating new user ${user.email}`);
        const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true
        });

        if (createError) {
          console.error(`DEBUG: Create error for ${user.email}`, createError);
          results.push({ email: user.email, id: null, status: "failed", error: createError.message });
        } else if (authUser?.user?.id) {
          console.log(`DEBUG: Created user ${user.email} with ID ${authUser.user.id}`);
          results.push({ email: user.email, id: authUser.user.id, status: "created" });
        } else {
          results.push({ email: user.email, id: null, status: "failed", error: "No user ID returned" });
        }
      } catch (e: any) {
        console.error(`DEBUG: Exception for ${user.email}`, e);
        results.push({ email: user.email, id: null, status: "failed", error: e.message });
      }
    }
    return results;
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    email: z.string().email(),
    password: z.string()
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;
    
    const found = listData?.users?.find((u: any) => u.email?.toLowerCase() === data.email.toLowerCase());
    
    if (!found) {
      throw new Error(`User ${data.email} not found`);
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      found.id,
      { password: data.password }
    );

    if (updateError) throw updateError;
    
    return { success: true, email: data.email };
  });

export const runRLSTest = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    userId: z.string().uuid()
  }).parse(data))
  .handler(async ({ data }) => {
    return { message: "Use the browser to test RLS after users are linked." };
  });
