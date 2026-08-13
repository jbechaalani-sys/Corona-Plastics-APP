/* ────────────────────────────────────────────────────────────
   Storage layer, backed by Supabase.

   The app already talks to window.storage (get/set/list/delete),
   so this file provides the same shape and the rest of the app
   carries on unchanged. Auth is added alongside it.
   ──────────────────────────────────────────────────────────── */
(function(){
  const cfg = window.CORONA_CONFIG || {};
  const ready = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('YOUR-PROJECT');
  if(!ready){
    console.warn('Supabase not configured — edit config.js. Running on this device only.');
    return;                              // app falls back to in-memory storage
  }

  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  const uid = () => sb.auth.getSession().then(r => r.data.session?.user?.id || null);

  window.storage = {
    async get(key){
      const { data, error } = await sb.from('records')
        .select('key,value,shared').eq('key', key).maybeSingle();
      if(error) throw new Error(error.message);
      return data ? {key: data.key, value: data.value, shared: data.shared} : null;
    },

    async set(key, value, shared){
      const owner = shared ? null : await uid();
      const { error } = await sb.from('records')
        .upsert({key, value, shared: !!shared, owner}, {onConflict: 'key'});
      if(error) throw new Error(error.message);
      return {key, value, shared: !!shared};
    },

    async list(prefix){
      const { data, error } = await sb.from('records')
        .select('key').like('key', (prefix || '') + '%').limit(5000);
      if(error) throw new Error(error.message);
      return {keys: (data || []).map(r => r.key), prefix};
    },

    async delete(key){
      const { error } = await sb.from('records').delete().eq('key', key);
      if(error) throw new Error(error.message);
      return {key, deleted: true};
    }
  };

  window.coronaAuth = {
    // the roster, so the sign-in screen can list real people
    async roster(){
      const { data, error } = await sb.from('staff')
        .select('op_id,name,role').eq('active', true).order('name');
      if(error) throw new Error(error.message);
      return data || [];
    },

    // the email is internal plumbing; operators only ever see a name and a code
    async signIn(opId, code){
      const { data, error } = await sb.auth.signInWithPassword({
        email: opId.toLowerCase() + '@corona.local',
        password: code
      });
      if(error) return {ok:false, message:'Code not recognised'};

      const { data: me } = await sb.from('staff')
        .select('op_id,name,role').eq('id', data.user.id).single();
      if(!me){ await sb.auth.signOut(); return {ok:false, message:'No staff record'}; }
      return {ok:true, ...me};
    },

    async signOut(){ await sb.auth.signOut(); },

    async current(){
      const { data } = await sb.auth.getSession();
      if(!data.session) return null;
      const { data: me } = await sb.from('staff')
        .select('op_id,name,role').eq('id', data.session.user.id).maybeSingle();
      return me || null;
    }
  };
})();
