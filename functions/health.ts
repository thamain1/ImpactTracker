export const onRequest = (context: any) => {
  return Response.json({
    ok: true,
    hasSupabaseUrl: !!context.env?.SUPABASE_URL,
    hasServiceKey: !!context.env?.SUPABASE_SERVICE_ROLE_KEY,
  });
};
