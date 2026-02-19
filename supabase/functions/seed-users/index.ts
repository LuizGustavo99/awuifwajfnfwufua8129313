import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if users already exist
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    if (existingUsers && existingUsers.users.length > 0) {
      return new Response(JSON.stringify({ message: "Users already exist", count: existingUsers.users.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Luiz
    const { data: luiz, error: luizErr } = await supabaseAdmin.auth.admin.createUser({
      email: "luiz@fincontrol.local",
      password: "Lu1z@123",
      email_confirm: true,
      user_metadata: { display_name: "Luiz" },
    });
    if (luizErr) throw new Error("Failed to create Luiz: " + luizErr.message);

    // Create Bruna
    const { data: bruna, error: brunaErr } = await supabaseAdmin.auth.admin.createUser({
      email: "bruna@fincontrol.local",
      password: "Bruna@123",
      email_confirm: true,
      user_metadata: { display_name: "Bruna" },
    });
    if (brunaErr) throw new Error("Failed to create Bruna: " + brunaErr.message);

    // Assign admin role to Luiz
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: luiz.user.id, role: "admin" });
    if (roleErr) throw new Error("Failed to assign admin role: " + roleErr.message);

    // Assign user role to Bruna
    const { error: roleErr2 } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: bruna.user.id, role: "user" });
    if (roleErr2) throw new Error("Failed to assign user role: " + roleErr2.message);

    return new Response(JSON.stringify({ message: "Users created successfully", luiz_id: luiz.user.id, bruna_id: bruna.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
