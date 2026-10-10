// Beépített szokások. A "pairs" lista alapján javasol a program (pl. Futás mellé Nyújtást).

const CATEGORIES = {
  egeszseg: { label: 'Egészség', icon: '❤️' },
  sport: { label: 'Sport', icon: '💪' },
  tanulas: { label: 'Tanulás', icon: '📚' },
  mentalis: { label: 'Mentális', icon: '🧘' },
  produktivitas: { label: 'Produktivitás', icon: '⚡' },
  kapcsolatok: { label: 'Kapcsolatok', icon: '🤝' },
  egyeb: { label: 'Egyéb', icon: '⭐' },
};

const GOALS = {
  egeszseg: { label: 'Egészségesebb élet', icon: '❤️' },
  fokusz: { label: 'Több fókusz', icon: '🎯' },
  nyugalom: { label: 'Nyugalom, kevesebb stressz', icon: '🌿' },
  tanulas: { label: 'Fejlődés, tanulás', icon: '📚' },
};

// Népszerű kezdő szokások, ha még nincs elég adat a javasláshoz.
const STARTERS = ['viz', 'alvas', 'olvasas', 'meditacio', 'seta', 'napi-terv'];

const CATALOG = [
  { id: 'viz', name: 'Igyál 2 liter vizet', icon: '💧', cat: 'egeszseg', goals: ['egeszseg'], pairs: ['gyumolcs', 'cukor'] },
  { id: 'alvas', name: 'Lefekvés 23:00 előtt', icon: '😴', cat: 'egeszseg', goals: ['egeszseg', 'fokusz', 'nyugalom'], pairs: ['kepernyo-este', 'korai-keles'] },
  { id: 'gyumolcs', name: 'Egyél zöldséget, gyümölcsöt', icon: '🥗', cat: 'egeszseg', goals: ['egeszseg'], pairs: ['viz', 'cukor'] },
  { id: 'cukor', name: 'Nincs édesség', icon: '🍫', cat: 'egeszseg', goals: ['egeszseg'], pairs: ['gyumolcs', 'viz'] },
  { id: 'vitamin', name: 'Vitaminok bevétele', icon: '💊', cat: 'egeszseg', goals: ['egeszseg'], pairs: ['viz', 'reggeli'] },
  { id: 'reggeli', name: 'Egészséges reggeli', icon: '🍳', cat: 'egeszseg', goals: ['egeszseg', 'fokusz'], pairs: ['viz', 'korai-keles'] },
  { id: 'kepernyo-este', name: 'Nincs képernyő lefekvés előtt', icon: '📵', cat: 'egeszseg', goals: ['nyugalom', 'egeszseg'], pairs: ['alvas', 'olvasas'] },

  { id: 'seta', name: '10 000 lépés', icon: '🚶', cat: 'sport', goals: ['egeszseg'], pairs: ['nyujtas', 'termeszet'] },
  { id: 'futas', name: 'Futás', icon: '🏃', cat: 'sport', goals: ['egeszseg'], pairs: ['nyujtas', 'viz', 'alvas'] },
  { id: 'edzes', name: 'Edzés / konditerem', icon: '🏋️', cat: 'sport', goals: ['egeszseg'], pairs: ['nyujtas', 'reggeli', 'viz'] },
  { id: 'nyujtas', name: 'Nyújtás 10 perc', icon: '🤸', cat: 'sport', goals: ['egeszseg', 'nyugalom'], pairs: ['joga', 'futas'] },
  { id: 'fekvotamasz', name: '20 fekvőtámasz', icon: '💪', cat: 'sport', goals: ['egeszseg'], pairs: ['plank', 'nyujtas'] },
  { id: 'plank', name: '1 perc plank', icon: '🧱', cat: 'sport', goals: ['egeszseg'], pairs: ['fekvotamasz'] },
  { id: 'joga', name: 'Jóga', icon: '🕉️', cat: 'sport', goals: ['nyugalom', 'egeszseg'], pairs: ['meditacio', 'nyujtas'] },
  { id: 'bicikli', name: 'Biciklizés', icon: '🚴', cat: 'sport', goals: ['egeszseg'], pairs: ['nyujtas', 'viz'] },

  { id: 'olvasas', name: 'Olvass 20 percet', icon: '📖', cat: 'tanulas', goals: ['tanulas', 'nyugalom'], pairs: ['jegyzet', 'kepernyo-este'] },
  { id: 'nyelv', name: 'Nyelvtanulás 15 perc', icon: '🗣️', cat: 'tanulas', goals: ['tanulas', 'fokusz'], pairs: ['szavak', 'podcast'] },
  { id: 'szavak', name: '5 új szó megtanulása', icon: '🔤', cat: 'tanulas', goals: ['tanulas'], pairs: ['nyelv'] },
  { id: 'podcast', name: 'Tanulós podcast vagy videó', icon: '🎧', cat: 'tanulas', goals: ['tanulas'], pairs: ['jegyzet', 'seta'] },
  { id: 'kodolas', name: 'Programozás gyakorlás', icon: '💻', cat: 'tanulas', goals: ['tanulas', 'fokusz'], pairs: ['melymunka', 'jegyzet'] },
  { id: 'jegyzet', name: 'A tanultak lejegyzése', icon: '📝', cat: 'tanulas', goals: ['tanulas'], pairs: ['olvasas'] },
  { id: 'hangszer', name: 'Hangszer gyakorlás', icon: '🎸', cat: 'tanulas', goals: ['tanulas', 'nyugalom'], pairs: ['nyujtas'] },

  { id: 'meditacio', name: 'Meditáció 10 perc', icon: '🧘', cat: 'mentalis', goals: ['nyugalom', 'fokusz'], pairs: ['legzes', 'naplo', 'halanaplo'] },
  { id: 'naplo', name: 'Naplóírás', icon: '📓', cat: 'mentalis', goals: ['nyugalom'], pairs: ['halanaplo', 'meditacio'] },
  { id: 'halanaplo', name: '3 dolog, amiért hálás vagy', icon: '🙏', cat: 'mentalis', goals: ['nyugalom'], pairs: ['naplo', 'kedvesseg'] },
  { id: 'legzes', name: 'Légzőgyakorlat', icon: '🌬️', cat: 'mentalis', goals: ['nyugalom', 'fokusz'], pairs: ['meditacio'] },
  { id: 'termeszet', name: 'Idő a szabadban', icon: '🌳', cat: 'mentalis', goals: ['nyugalom', 'egeszseg'], pairs: ['seta'] },
  { id: 'social-limit', name: 'Max. 1 óra közösségi média', icon: '📱', cat: 'mentalis', goals: ['fokusz', 'nyugalom'], pairs: ['kepernyo-este', 'olvasas'] },

  { id: 'korai-keles', name: 'Korai kelés', icon: '⏰', cat: 'produktivitas', goals: ['fokusz'], pairs: ['alvas', 'agyazas', 'napi-terv'] },
  { id: 'agyazas', name: 'Ágyazás reggel', icon: '🛏️', cat: 'produktivitas', goals: ['fokusz'], pairs: ['korai-keles', 'rendrakas'] },
  { id: 'napi-terv', name: 'Napi teendőlista', icon: '✅', cat: 'produktivitas', goals: ['fokusz'], pairs: ['melymunka', 'esti-attekintes'] },
  { id: 'melymunka', name: '1 óra mélymunka', icon: '🎯', cat: 'produktivitas', goals: ['fokusz'], pairs: ['napi-terv', 'social-limit'] },
  { id: 'esti-attekintes', name: 'Esti napértékelés', icon: '🌙', cat: 'produktivitas', goals: ['fokusz', 'nyugalom'], pairs: ['napi-terv', 'naplo'] },
  { id: 'rendrakas', name: '15 perc rendrakás', icon: '🧹', cat: 'produktivitas', goals: ['nyugalom'], pairs: ['agyazas'] },
  { id: 'penz', name: 'Kiadások vezetése', icon: '💰', cat: 'produktivitas', goals: ['fokusz'], pairs: ['napi-terv'] },

  { id: 'csalad', name: 'Hívd fel a családod', icon: '📞', cat: 'kapcsolatok', goals: ['nyugalom'], pairs: ['baratok'] },
  { id: 'baratok', name: 'Írj egy barátodnak', icon: '💬', cat: 'kapcsolatok', goals: ['nyugalom'], pairs: ['csalad'] },
  { id: 'kedvesseg', name: 'Egy jó cselekedet', icon: '💝', cat: 'kapcsolatok', goals: ['nyugalom'], pairs: ['halanaplo', 'dicseret'] },
  { id: 'kozos-ido', name: 'Minőségi idő a szeretteiddel', icon: '🍽️', cat: 'kapcsolatok', goals: ['nyugalom'], pairs: ['kepernyo-este', 'csalad'] },
  { id: 'dicseret', name: 'Dicsérj meg valakit', icon: '🌟', cat: 'kapcsolatok', goals: ['nyugalom'], pairs: ['kedvesseg'] },
];

const CATALOG_BY_ID = Object.fromEntries(CATALOG.map(c => [c.id, c]));
