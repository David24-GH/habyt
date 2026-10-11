# Habyt – szokáskövető

Piros–fekete szokáskövető app esti check-innel, éves hőtérképpel, havi naptárral és streakekkel.
Telepíthető webapp (PWA): PC-n saját ablakban fut, telefonon a kezdőképernyőre tehető, és net nélkül is működik.

**Élő oldal:** https://habyt-sooty.vercel.app

## Funkciók

- **Ma**: a napi szokások kipipálása, haladásjelző, „tökéletes nap” ünneplés. Nyilakkal a korábbi napok is pótolhatók.
- **Szokások**: saját szokás (név, ikon, kategória, mely napokon), kb. 40 beépített szokás katalógusa, és „Javasolt neked” ajánlások a célod meg a meglévő szokásaid alapján.
- **Statisztika**: tökéletes napok sorozata, az elmúlt év hőtérképe, havi naptár szokásonként (napra kattintva utólag módosítható), sorozatok szokásonként.
- **Beállítások**: esti check-in időpontja (alapból 20:00), értesítés, telepítés, mentés és betöltés fájlból.

## Futtatás a gépen

```
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

Utána a böngészőben: http://localhost:8793

## Esti automatikus megnyitás (PC)

Egyszer kell lefuttatni, és onnantól a Windows Feladatütemező minden este 20:00-kor megnyitja az appot:

```
powershell -ExecutionPolicy Bypass -File .\install-reminder.ps1
```

Más időpont vagy cím: `-Time 21:30 -Url "https://.../?checkin=1"`. Ha 20:00-kor ki volt kapcsolva a gép, bekapcsolás után pótolja.
Kikapcsolás: `uninstall-reminder.ps1`.

## Telefonra telepítés

1. Nyisd meg a https://habyt-sooty.vercel.app címet a telefonon.
2. Androidon (Chrome): menü → **Alkalmazás telepítése**. iPhone-on (Safari): Megosztás → **Főképernyőhöz adás**.

## Szinkronizálás (PC ↔ telefon)

Az app csak bejelentkezve használható: megnyitáskor a belépőoldal jön (regisztráció hősnévvel és kétszer megadott jelszóval,
bejelentkezés, elfelejtett jelszó). Regisztráció után egy rövid kezdő kérdőív ajánl szokásokat. A bejelentkezés megmarad
az eszközön; kijelentkezéskor az adatok eltűnnek az eszközről, de a fiókban megmaradnak.

Jelentkezz be ugyanazzal az email-címmel és jelszóval minden eszközön.
Az adatok a böngészőben is megmaradnak, így az app net nélkül is megy, és amint lesz internet, szinkronizál.

- Ha az egyik eszközön az egyik, a másikon egy másik szokást pipálsz ki, mindkettő megmarad.
- Ha ugyanazt módosítod két helyen, a későbbi módosítás nyer.
- Az értesítés be-/kikapcsolása eszközönként külön marad.
- A hősöd (név, nem, bőrszín) és a kiemelt badge-ek is szinkronizálódnak.

### Ranglétra (előkészítve)

Bejelentkezve az app minden szinkron után feltölti a hősöd nevét, szintjét, rangját és XP-jét a `habyt_profiles` táblába
(email nélkül). A **Megjelenés a ranglétrán** kapcsolóval ez elrejthető. Erre épülhet majd a ranglétra nézet.

### Beállítás egyszer (Supabase)

1. Hozz létre egy ingyenes projektet a https://supabase.com oldalon.
2. **SQL Editor** → új lekérdezés → másold be a [supabase/schema.sql](supabase/schema.sql) tartalmát → **Run**.
3. **Authentication → URL Configuration → Site URL**: `https://habyt-sooty.vercel.app`, és a **Redirect URLs** közé is ezt add hozzá.
4. Írd be a projekt címét és a *publishable* (vagy *anon*) kulcsot a [js/config.js](js/config.js) fájlba.
   A *secret* / *service_role* kulcs soha ne kerüljön a kódba.

Biztonsági mentés fájlba továbbra is készíthető: **Beállítások → Mentés fájlba**.

## Tervezett következő lépés

20:00-s push értesítés telefonra (Vercel cron + Web Push).
