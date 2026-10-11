// Supabase-kapcsolat a szinkronhoz. A "publishable" (régebben "anon") kulcs nyilvános,
// nyugodtan lehet a kódban: az adatokat a táblán lévő szabályok (RLS) védik.
// Soha ne kerüljön ide a "secret" / "service_role" kulcs!
window.HABYT_CONFIG = {
  supabaseUrl: '',
  supabaseKey: '',
};
