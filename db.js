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

    // fetch only what matches a pattern, so a screen that wants one day
    // does not drag back every record ever written. % is the wildcard.
    async listLike(pattern){
      const { data, error } = await sb.from('records')
        .select('key,value').like('key', pattern).limit(5000);
      if(error) throw new Error(error.message);
      return (data || []).map(r => [r.key, r.value]);
    },

    // keys and values in one request — an admin screen used to make
    // one request per record, which is hundreds for a single month
    async listAll(prefix){
      const { data, error } = await sb.from('records')
        .select('key,value').like('key', (prefix || '') + '%').limit(5000);
      if(error) throw new Error(error.message);
      return (data || []).map(r => [r.key, r.value]);
    },

    async delete(key){
      const { error } = await sb.from('records').delete().eq('key', key);
      if(error) throw new Error(error.message);
      return {key, deleted: true};
    }
  };

  // where a phone registers itself for notifications
  window.savePushSub = async row => {
    const { error } = await sb.from('push_subs').upsert(row, {onConflict: 'endpoint'});
    if(error) throw new Error(error.message);
  };
  window.dropPushSub = async endpoint => {
    await sb.from('push_subs').delete().eq('endpoint', endpoint);
  };
  // who is actually reachable, for the admin screen
  window.pushStatus = async () => {
    const { data, error } = await sb.from('push_status').select('*');
    if(error) throw new Error(error.message);
    return data || [];
  };

  /* Is this browser still signed in? A session that has quietly expired
     makes every write fail, which looks exactly like being offline but
     needs a completely different fix. */
  window.coronaSession = async () => {
    try{
      const { data, error } = await sb.auth.getSession();
      if(error) return {ok:false, why:'error', message:error.message};
      if(!data || !data.session) return {ok:false, why:'signed-out'};
      const exp = data.session.expires_at ? data.session.expires_at * 1000 : 0;
      if(exp && exp < Date.now()) return {ok:false, why:'expired'};
      return {ok:true, uid:data.session.user && data.session.user.id};
    }catch(e){ return {ok:false, why:'error', message:String(e && e.message)}; }
  };

  // ask Supabase for a fresh token; sessions expire after an hour
  window.coronaRefresh = async () => {
    try{
      const { data, error } = await sb.auth.refreshSession();
      return !error && !!(data && data.session);
    }catch(e){ return false; }
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
