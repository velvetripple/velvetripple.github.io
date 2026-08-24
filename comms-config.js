/* VELVET RIPPLE · comms backend config
   ------------------------------------------------------------------
   the logbook is public: every visitor sees every transmission. that
   needs a server, and github pages has none — so the lines live in a
   supabase table and this file points at it.

   fill these two in from your supabase project:
     dashboard → project settings → api
       url  = "project url"
       key  = "anon public" key   ← the publishable one. it is MEANT to
              be in client code; every rule that matters is enforced by
              postgres row-level security, not by hiding this string.
              never paste the "service_role" key here.

   LEAVE THEM EMPTY and the logbook quietly falls back to browser-local
   storage — the page still works, lines still persist and delete, but
   only for the person who wrote them. see supabase-setup.sql.         */
window.VR_COMMS = {
  url: 'https://vtvolbtfcuxjqtjkjlmf.supabase.co',
  key: 'sb_publishable_9QCf09ZIbYuQuxdYp4G0cQ_6NX2tiWZ',

  /* how often to pull new lines while the panel is open, in seconds.
     polling pauses entirely when the tab is hidden. */
  poll: 20
};
